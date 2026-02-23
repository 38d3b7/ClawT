import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getAgentByUser } from "@/lib/db/queries";

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await getAgentByUser(address);
  if (!agent) {
    return NextResponse.json({ error: "No agent found" }, { status: 404 });
  }
  if (!agent.instanceIp) {
    return NextResponse.json(
      { error: "Agent has no reachable IP" },
      { status: 502 }
    );
  }

  try {
    const body = await request.json();
    const agentRes = await fetch(`http://${agent.instanceIp}:3001/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!agentRes.ok) {
      const errBody = await agentRes.text();
      return NextResponse.json(
        { error: errBody || "Agent returned an error" },
        { status: agentRes.status }
      );
    }

    const result = await agentRes.json();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach agent: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }
}
