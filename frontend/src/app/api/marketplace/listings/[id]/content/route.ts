import { NextRequest, NextResponse } from "next/server";
import { getListingById, recordPurchase } from "@/lib/db/queries";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
import { MARKETPLACE_CHAIN } from "@/lib/network-config";

const MARKETPLACE_NETWORK = `eip155:${MARKETPLACE_CHAIN.id}` as const;

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitatorClient);
server.register("eip155:*", new ExactEvmScheme());

let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await server.initialize();
    initialized = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  await ensureInitialized();

  const priceUsd = `$${(listing.price / 1_000_000).toFixed(2)}`;

  const resourceConfig = {
    scheme: "exact",
    payTo: listing.sellerAddress,
    price: priceUsd,
    network: MARKETPLACE_NETWORK,
  };

  const resourceInfo = {
    url: request.url,
    description: `Purchase: ${listing.title}`,
    mimeType: "application/json",
  };

  const paymentHeader = request.headers.get("x-payment");
  let paymentPayload = null;

  if (paymentHeader) {
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8")
      );
    } catch {
      return NextResponse.json(
        { error: "Malformed X-PAYMENT header" },
        { status: 400 }
      );
    }
  }

  const result = await server.processPaymentRequest(
    paymentPayload,
    resourceConfig,
    resourceInfo
  );

  if (result.requiresPayment) {
    return new NextResponse(
      JSON.stringify(result.requiresPayment),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-REQUIRED": Buffer.from(
            JSON.stringify(result.requiresPayment)
          ).toString("base64"),
        },
      }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Payment failed" },
      { status: 402 }
    );
  }

  const txHash = result.settlementResult?.transaction ?? "pending";
  const payer = result.settlementResult?.payer ?? result.verificationResult?.payer ?? "unknown";

  await recordPurchase(payer, id, txHash);

  const response = NextResponse.json({ content: listing.content });
  if (result.settlementResult) {
    response.headers.set(
      "X-PAYMENT-RESPONSE",
      Buffer.from(JSON.stringify(result.settlementResult)).toString("base64")
    );
  }
  return response;
}
