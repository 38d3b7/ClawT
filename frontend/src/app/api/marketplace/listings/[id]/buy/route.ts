import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getListingById, hasPurchased, recordPurchase } from "@/lib/db/queries";
import { verifyUSDCTransfer } from "@/lib/usdc";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (address.toLowerCase() === listing.sellerAddress.toLowerCase()) {
    return NextResponse.json({ content: listing.content });
  }

  const alreadyOwned = await hasPurchased(address, id);
  if (alreadyOwned) {
    return NextResponse.json({ content: listing.content });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txHash } = body as { txHash?: string };
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Valid txHash required" }, { status: 400 });
  }

  const result = await verifyUSDCTransfer(
    txHash as `0x${string}`,
    listing.sellerAddress,
    BigInt(listing.price)
  );

  if (!result.verified) {
    return NextResponse.json(
      { error: "Payment verification failed. Ensure the USDC transfer is confirmed on Base Sepolia." },
      { status: 402 }
    );
  }

  if (result.from.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: "Transaction sender does not match authenticated address" },
      { status: 403 }
    );
  }

  await recordPurchase(address, id, txHash);
  return NextResponse.json({ content: listing.content });
}
