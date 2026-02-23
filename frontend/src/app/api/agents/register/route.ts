import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { ensureUser, createAgent, updateAgent, getAgentByUser } from "@/lib/db/queries";

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, appId, walletAddressEth, instanceIp } = await request.json();
    if (!name || !appId) {
      return NextResponse.json(
        { error: "Missing name or appId" },
        { status: 400 }
      );
    }

    await ensureUser(address);

    const existing = await getAgentByUser(address);
    if (existing) {
      return NextResponse.json(
        { error: "Agent already exists for this wallet" },
        { status: 409 }
      );
    }

    const ecloudName = `clawt-${address.slice(2, 10)}`;
    const agentId = await createAgent(address, name);
    await updateAgent(agentId, {
      appId,
      ecloudName,
      walletAddressEth: walletAddressEth ?? null,
      instanceIp: instanceIp ?? null,
      status: "running",
    });

    return NextResponse.json({ agentId, appId });
  } catch (err) {
    return NextResponse.json(
      { error: `Registration failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
