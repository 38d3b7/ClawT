import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getPurchasesByUser } from "@/lib/db/queries";
import { formatUSDC } from "@/lib/usdc";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "skill" | "soul" | null;

    const rows = await getPurchasesByUser(address, type ?? undefined);
    const items = rows.map((r) => ({
      purchaseId: r.id,
      txHash: r.txHash,
      purchasedAt: r.createdAt,
      listing: {
        id: r.listing.id,
        type: r.listing.type,
        title: r.listing.title,
        description: r.listing.description,
        price: r.listing.price,
        priceFormatted: formatUSDC(r.listing.price),
        sellerAddress: r.listing.sellerAddress,
        content: r.listing.content,
      },
    }));

    return NextResponse.json({ purchases: items });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch purchases: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
