import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { COMPUTE_API_URL } from "@/lib/network-config";

const COMPUTE_API = COMPUTE_API_URL;
const FETCH_TIMEOUT_MS = 8_000;

async function loginToComputeApi(message: string, signature: string) {
  const res = await fetch(`${COMPUTE_API}/auth/siwe/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature: signature.replace(/^0x/, "") }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Compute API login failed (${res.status}): ${body}`);
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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Compute API returned ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      { error: isTimeout ? "Compute API request timed out" : `App info proxy error: ${message}` },
      { status: 504 }
    );
  }
}
