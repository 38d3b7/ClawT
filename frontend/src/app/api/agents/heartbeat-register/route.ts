import { NextResponse } from "next/server";
import { getAgentByUser, updateAgent } from "@/lib/db/queries";
import { verifyMessage } from "viem";

export async function POST(request: Request) {
  const tag = `[heartbeat ${Date.now()}]`;
  try {
    const { walletAddress, timestamp, signature, instanceIp } = await request.json();
    console.log(`${tag} received wallet=${String(walletAddress).slice(0, 10)} ip=${instanceIp} ts=${timestamp}`);

    if (!walletAddress || !timestamp || !signature) {
      console.warn(`${tag} missing fields wallet=${!!walletAddress} ts=${!!timestamp} sig=${!!signature}`);
      return NextResponse.json(
        { error: "Missing walletAddress, timestamp, or signature" },
        { status: 400 }
      );
    }

    const ts = Number(timestamp);
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      console.warn(`${tag} stale timestamp drift=${Math.abs(Date.now() - ts)}ms`);
      return NextResponse.json({ error: "Timestamp too stale" }, { status: 400 });
    }

    const message = `clawt-agent-heartbeat:${walletAddress}:${timestamp}`;
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      console.warn(`${tag} invalid signature for ${String(walletAddress).slice(0, 10)}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.log(`${tag} signature valid`);

    const agents = await import("@/lib/db/client").then((m) => m.getDb());
    const { agents: agentsTable } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await agents
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.walletAddressEth, walletAddress.toLowerCase()))
      .limit(1);

    if (rows.length === 0) {
      console.log(`${tag} no exact wallet match, trying fuzzy`);
      const allAgents = await agents
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.status, "running"))
        .limit(50);

      console.log(`${tag} fuzzy candidates: ${allAgents.length} running agents`);
      const match = allAgents.find(
        (a) => !a.walletAddressEth || a.walletAddressEth === walletAddress.toLowerCase()
      );

      if (match) {
        await updateAgent(match.id, {
          walletAddressEth: walletAddress.toLowerCase(),
          ...(instanceIp && { instanceIp }),
        });
        console.log(`${tag} fuzzy matched agent id=${match.id} appId=${match.appId} ip=${instanceIp}`);
        return NextResponse.json({ ok: true, matched: true });
      }

      console.warn(`${tag} no fuzzy match found among ${allAgents.length} candidates`);
      return NextResponse.json({ error: "No matching agent found" }, { status: 404 });
    }

    const agent = rows[0];
    if (instanceIp && instanceIp !== agent.instanceIp) {
      await updateAgent(agent.id, { instanceIp });
      console.log(`${tag} updated IP for agent id=${agent.id} ip=${instanceIp}`);
    } else {
      console.log(`${tag} heartbeat OK agent id=${agent.id} ip unchanged`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error:`, err);
    return NextResponse.json(
      { error: `Heartbeat failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
