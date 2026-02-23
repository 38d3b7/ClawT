import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getAgentByUser, updateAgent } from "@/lib/db/queries";

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agent = await getAgentByUser(address);
  if (!agent) {
    return NextResponse.json({ error: "No agent found" }, { status: 404 });
  }

  try {
    const { status, instanceIp, walletAddressEth } = await request.json();
    await updateAgent(agent.id, {
      ...(status !== undefined && { status }),
      ...(instanceIp !== undefined && { instanceIp }),
      ...(walletAddressEth !== undefined && { walletAddressEth }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Update failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
