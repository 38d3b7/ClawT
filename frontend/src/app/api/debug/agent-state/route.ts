import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getAgentByUser } from "@/lib/db/queries";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await getAgentByUser(address);
  if (!agent) {
    return NextResponse.json({ agent: null });
  }

  return NextResponse.json({
    id: agent.id,
    status: agent.status,
    appId: agent.appId,
    walletAddressEth: agent.walletAddressEth,
    instanceIp: agent.instanceIp,
    createdAt: agent.createdAt,
    hasWallet: !!agent.walletAddressEth,
    hasIp: !!agent.instanceIp,
  });
}
