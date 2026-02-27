import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getAgentByUser, updateAgent } from "@/lib/db/queries";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await import("@/lib/db/client").then((m) => m.getDb());
  const { agents: agentsTable } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const allRows = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.userAddress, address.toLowerCase()));

  const active = allRows.filter((a) => a.status !== "terminated");
  const current = await getAgentByUser(address);

  const ghosts = allRows.filter(
    (a) => a.status === "terminated" && a.appId && a.appId !== current?.appId
  );

  return NextResponse.json({ current, allAgents: active, ghosts, total: allRows.length });
}

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, action } = await request.json();
  if (action !== "terminate" || typeof agentId !== "number") {
    return NextResponse.json({ error: "Only action=terminate with numeric agentId" }, { status: 400 });
  }

  const db = await import("@/lib/db/client").then((m) => m.getDb());
  const { agents: agentsTable } = await import("@/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.userAddress, address.toLowerCase())))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Agent not found or not yours" }, { status: 404 });
  }

  await updateAgent(agentId, { status: "terminated" });
  return NextResponse.json({ ok: true, terminated: agentId });
}
