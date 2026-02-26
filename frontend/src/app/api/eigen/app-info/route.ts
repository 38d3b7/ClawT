import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { COMPUTE_API_URL } from "@/lib/network-config";
import { getAgentByUser, updateAgent } from "@/lib/db/queries";

const COMPUTE_API = COMPUTE_API_URL;
const FETCH_TIMEOUT_MS = 8_000;

const TERMINATED_STATUSES = new Set(["terminated", "Terminated", "TERMINATED"]);

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
    console.log("[app-info proxy] SIWE login OK, cookie length:", cookieHeader.length);

    const params = new URLSearchParams({ apps: appIds.join(",") });
    const res = await fetch(`${COMPUTE_API}/info?${params}`, {
      headers: { Cookie: cookieHeader },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[app-info proxy] /info failed:", res.status, body);
      return NextResponse.json(
        { error: `Compute API returned ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log(
      "[app-info proxy] /info OK, apps:",
      data.apps?.map((a: { app_status?: string; ip?: string }) => ({
        status: a.app_status,
        ip: a.ip,
      }))
    );

    syncTerminatedStatus(address, data).catch(() => {});

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTerminatedStatus(userAddress: string, data: any) {
  const apps = data?.apps;
  if (!Array.isArray(apps) || apps.length === 0) return;

  const anyTerminated = apps.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app: any) => app.app_status && TERMINATED_STATUSES.has(app.app_status)
  );
  if (!anyTerminated) return;

  const agent = await getAgentByUser(userAddress);
  if (agent) {
    await updateAgent(agent.id, { status: "terminated" });
  }
}
