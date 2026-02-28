import { NextResponse } from "next/server";
import { verifySiwe, createSessionToken, getRequestNetwork } from "@/lib/auth-server";
import { ensureUser, getAgentByUser } from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const { message, signature } = await request.json();
    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 }
      );
    }

    const address = await verifySiwe(message, signature);
    await ensureUser(address);

    const token = createSessionToken(address);
    const agent = await getAgentByUser(address, getRequestNetwork(request));

    return NextResponse.json({
      address,
      token,
      hasAgent: agent !== null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Auth failed: ${err instanceof Error ? err.message : err}` },
      { status: 401 }
    );
  }
}
