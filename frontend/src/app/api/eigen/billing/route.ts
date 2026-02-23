import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { billingSignature, billingExpiry, billingAddress, action, returnUrl } =
      await request.json();

    if (!billingSignature || !billingExpiry || !billingAddress) {
      return NextResponse.json({ error: "Missing billing auth params" }, { status: 400 });
    }

    const { getBillingEnvironmentConfig } = await import("@layr-labs/ecloud-sdk/browser");
    const { billingApiServerURL: baseUrl } = getBillingEnvironmentConfig("prod");

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${billingSignature}`,
      "X-Account": billingAddress,
      "X-Expiry": billingExpiry,
    };

    if (action === "subscribe") {
      const subRes = await fetch(`${baseUrl}/products/compute/subscription`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: returnUrl,
          cancel_url: returnUrl,
          return_url: returnUrl,
        }),
      });
      if (!subRes.ok) {
        const body = await subRes.text();
        throw new Error(`createSubscription failed (${subRes.status}): ${body}`);
      }
      const data = await subRes.json();
      console.log("[billing] createSubscription result:", JSON.stringify(data));

      if (data.type === "already_active" || data.type === "payment_issue") {
        const params = returnUrl ? `?${new URLSearchParams({ return_url: returnUrl })}` : "";
        const statusRes = await fetch(`${baseUrl}/products/compute/subscription${params}`, {
          method: "GET",
          headers: authHeaders,
        });
        const sub = statusRes.ok ? await statusRes.json() : {};
        return NextResponse.json({
          alreadyActive: true,
          subscriptionStatus: data.status ?? sub.subscriptionStatus,
          portalUrl: data.portalUrl ?? sub.portalUrl,
        });
      }

      return NextResponse.json({ checkoutUrl: data.checkoutUrl });
    }

    const params = returnUrl ? `?${new URLSearchParams({ return_url: returnUrl })}` : "";
    const subRes = await fetch(`${baseUrl}/products/compute/subscription${params}`, {
      method: "GET",
      headers: authHeaders,
    });

    if (!subRes.ok) {
      const body = await subRes.text();
      console.warn("[billing] getSubscription failed:", subRes.status, body);
      return NextResponse.json({
        subscriptionStatus: "inactive",
        active: false,
        debugInfo: `billing API ${subRes.status}: ${body.slice(0, 500)}`,
      });
    }

    const sub = await subRes.json();
    const isActive = sub.subscriptionStatus === "active";
    console.log("[billing] subscription result:", JSON.stringify(sub));
    return NextResponse.json({
      subscriptionStatus: sub.subscriptionStatus,
      active: isActive,
      portalUrl: sub.portalUrl,
      currentPeriodEnd: sub.currentPeriodEnd,
      lineItems: sub.lineItems,
      debugInfo: isActive
        ? undefined
        : `status=${sub.subscriptionStatus}, raw=${JSON.stringify(sub).slice(0, 300)}`,
    });
  } catch (err) {
    console.error("[billing] route error:", err);
    return NextResponse.json(
      { error: `Billing proxy error: ${err instanceof Error ? err.message : err}` },
      { status: 502 }
    );
  }
}
