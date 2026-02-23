import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";

const COMPUTE_API = "https://userapi-compute-sepolia-prod.eigencloud.xyz";

async function loginToComputeApi(message: string, signature: string) {
  const res = await fetch(`${COMPUTE_API}/auth/siwe/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature: signature.replace(/^0x/, "") }),
  });
  if (!res.ok) {
    throw new Error(`Compute API login failed: ${res.status}`);
  }
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c: string) => c.split(";")[0]).join("; ");
}

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { siweMessage, siweSignature, appIds } = await request.json();

    if (!siweMessage || !siweSignature || !appIds?.length) {
      return NextResponse.json(
        { error: "Missing SIWE credentials or appIds" },
        { status: 400 }
      );
    }

    const cookieHeader = await loginToComputeApi(siweMessage, siweSignature);
    const params = new URLSearchParams({ apps: appIds.join(",") });
    const res = await fetch(`${COMPUTE_API}/info?${params}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Compute API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `App info proxy error: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }
}
