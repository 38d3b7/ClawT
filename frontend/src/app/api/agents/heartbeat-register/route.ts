import { NextResponse } from "next/server";
import { updateAgent } from "@/lib/db/queries";
import { verifyMessage } from "viem";

export async function POST(request: Request) {
  const tag = `[heartbeat ${Date.now()}]`;
  try {
    const { walletAddress, timestamp, signature, instanceIp, appId } = await request.json();
    console.log(
      `${tag} received wallet=${String(walletAddress).slice(0, 10)} ip=${instanceIp} appId=${appId ?? "none"}`
    );

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

    const db = await import("@/lib/db/client").then((m) => m.getDb());
    const { agents: agentsTable } = await import("@/lib/db/schema");
    const { eq, and, isNull } = await import("drizzle-orm");

    // Strategy 1: direct match by appId (new agents inject AGENT_APP_ID)
    if (appId) {
      const rows = await db
        .select()
        .from(agentsTable)
        .where(and(eq(agentsTable.appId, appId), eq(agentsTable.status, "running")))
        .limit(1);

      if (rows.length > 0) {
        const agent = rows[0];
        const updates: Record<string, string> = {};
        if (!agent.walletAddressEth) updates.walletAddressEth = walletAddress.toLowerCase();
        if (instanceIp && instanceIp !== agent.instanceIp) updates.instanceIp = instanceIp;

        if (Object.keys(updates).length > 0) {
          await updateAgent(agent.id, updates);
          console.log(`${tag} appId match → agent id=${agent.id} updated: ${JSON.stringify(updates)}`);
        } else {
          console.log(`${tag} appId match → agent id=${agent.id} unchanged`);
        }
        return NextResponse.json({ ok: true });
      }
      console.warn(`${tag} appId ${appId} not found or not running`);
    }

    // Strategy 2: exact wallet match (returning agents already bound)
    const walletRows = await db
      .select()
      .from(agentsTable)
      .where(
        and(eq(agentsTable.walletAddressEth, walletAddress.toLowerCase()), eq(agentsTable.status, "running"))
      )
      .limit(1);

    if (walletRows.length > 0) {
      const agent = walletRows[0];
      if (instanceIp && instanceIp !== agent.instanceIp) {
        await updateAgent(agent.id, { instanceIp });
        console.log(`${tag} wallet match → agent id=${agent.id} ip=${instanceIp}`);
      } else {
        console.log(`${tag} wallet match → agent id=${agent.id} ip unchanged`);
      }
      return NextResponse.json({ ok: true });
    }

    // Strategy 3: fuzzy — find a running agent with no wallet bound yet
    console.log(`${tag} no direct match, trying fuzzy`);
    const candidates = await db
      .select()
      .from(agentsTable)
      .where(and(eq(agentsTable.status, "running"), isNull(agentsTable.walletAddressEth)))
      .limit(10);

    console.log(`${tag} fuzzy candidates: ${candidates.length} running agents with null wallet`);
    if (candidates.length === 1) {
      const agent = candidates[0];
      await updateAgent(agent.id, {
        walletAddressEth: walletAddress.toLowerCase(),
        ...(instanceIp && { instanceIp }),
      });
      console.log(`${tag} fuzzy matched agent id=${agent.id} appId=${agent.appId} ip=${instanceIp}`);
      return NextResponse.json({ ok: true, matched: true });
    }

    if (candidates.length > 1) {
      console.warn(`${tag} ambiguous: ${candidates.length} unbound agents, refusing to guess`);
      return NextResponse.json(
        { error: "Multiple unbound agents — include appId in heartbeat for direct match" },
        { status: 409 }
      );
    }

    console.warn(`${tag} no matching agent found`);
    return NextResponse.json({ error: "No matching agent found" }, { status: 404 });
  } catch (err) {
    console.error(`${tag} error:`, err);
    return NextResponse.json(
      { error: `Heartbeat failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
