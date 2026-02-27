import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getAgentByUser } from "@/lib/db/queries";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await getAgentByUser(address);
  if (!agent?.instanceIp) {
    return NextResponse.json({ error: "Agent not reachable" }, { status: 502 });
  }

  try {
    const res = await fetch(`http://${agent.instanceIp}:3000/evolution`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Evolution fetch failed" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach agent: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }
}
