import { NextResponse } from "next/server";
import { getAgentByUser, updateAgent } from "@/lib/db/queries";
import { verifyMessage } from "viem";

export async function POST(request: Request) {
  try {
    const { walletAddress, timestamp, signature, instanceIp } = await request.json();

    if (!walletAddress || !timestamp || !signature) {
      return NextResponse.json(
        { error: "Missing walletAddress, timestamp, or signature" },
        { status: 400 }
      );
    }

    const ts = Number(timestamp);
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Timestamp too stale" }, { status: 400 });
    }

    const message = `clawt-agent-heartbeat:${walletAddress}:${timestamp}`;
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const agents = await import("@/lib/db/client").then((m) => m.getDb());
    const { agents: agentsTable } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await agents
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.walletAddressEth, walletAddress.toLowerCase()))
      .limit(1);

    if (rows.length === 0) {
      const allAgents = await agents
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.status, "running"))
        .limit(50);

      const match = allAgents.find(
        (a) => !a.walletAddressEth || a.walletAddressEth === walletAddress.toLowerCase()
      );

      if (match) {
        await updateAgent(match.id, {
          walletAddressEth: walletAddress.toLowerCase(),
          ...(instanceIp && { instanceIp }),
        });
        return NextResponse.json({ ok: true, matched: true });
      }

      return NextResponse.json({ error: "No matching agent found" }, { status: 404 });
    }

    const agent = rows[0];
    if (instanceIp && instanceIp !== agent.instanceIp) {
      await updateAgent(agent.id, { instanceIp });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Heartbeat failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
