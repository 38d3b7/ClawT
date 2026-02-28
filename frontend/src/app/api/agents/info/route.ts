import { NextResponse } from "next/server";
import { getAuthAddress, getRequestNetwork } from "@/lib/auth-server";
import { getAgentByUser } from "@/lib/db/queries";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await getAgentByUser(address, getRequestNetwork(request));
  if (!agent) {
    return NextResponse.json(null, { status: 404 });
  }

  let healthy: boolean | null = null;

  if (agent.instanceIp && agent.status === "running") {
    try {
      const res = await fetch(`http://${agent.instanceIp}:3000/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      healthy = res.ok;
    } catch {
      healthy = false;
    }
  }

  return NextResponse.json({
    name: agent.name,
    status: agent.status,
    appId: agent.appId,
    walletAddressEth: agent.walletAddressEth,
    instanceIp: agent.instanceIp,
    createdAt: agent.createdAt,
    healthy,
  });
}
