import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getListingById, delistListing, hasPurchased } from "@/lib/db/queries";
import { formatUSDC } from "@/lib/usdc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const address = getAuthAddress(request);
  const isOwner = address?.toLowerCase() === listing.sellerAddress.toLowerCase();
  const purchased = address ? await hasPurchased(address, id) : false;

  const preview = listing.content.slice(0, 200) + (listing.content.length > 200 ? "..." : "");

  return NextResponse.json({
    id: listing.id,
    type: listing.type,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    priceFormatted: formatUSDC(listing.price),
    sellerAddress: listing.sellerAddress,
    preview,
    isOwner,
    purchased,
    content: purchased || isOwner ? listing.content : null,
    createdAt: listing.createdAt,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await delistListing(id, address);
  if (!ok) {
    return NextResponse.json({ error: "Not found or not owner" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
