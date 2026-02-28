import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { COMPUTE_API_URL } from "@/lib/network-config";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");
  if (!appId) {
    return NextResponse.json({ error: "Missing appId" }, { status: 400 });
  }

  const base = process.env.EIGEN_COMPUTE_API_URL ?? COMPUTE_API_URL;

  const results: Record<string, unknown> = {};

  try {
    const infoRes = await fetch(`${base}/info?apps=${appId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (infoRes.ok) {
      const data = await infoRes.json();
      const app = data.apps?.[0];
      if (app) {
        results.teeStatus = app.app_status;
        results.teeIp = app.ip;
        results.machineType = app.machine_type;
        results.derivedWallet = app.addresses?.data?.evmAddresses?.[0]?.address;
        results.metrics = app.metrics;
      }
    } else {
      results.infoError = `HTTP ${infoRes.status}`;
    }
  } catch (err) {
    results.infoError = err instanceof Error ? err.message : String(err);
  }

  try {
    const statusRes = await fetch(`${base}/status?apps=${appId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (statusRes.ok) {
      const data = await statusRes.json();
      results.contractStatus = data.apps?.[0]?.app_status;
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json(results);
}
