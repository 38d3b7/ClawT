import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";
import { getActiveListings, createListing, ensureUser } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "skill" | "soul" | null;

  if (type && type !== "skill" && type !== "soul") {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }

  const items = await getActiveListings(type ?? undefined);
  return NextResponse.json({ listings: items });
}

export async function POST(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, title, description, price, content } = body as {
    type?: string;
    title?: string;
    description?: string;
    price?: number;
    content?: string;
  };

  if (!type || (type !== "skill" && type !== "soul")) {
    return NextResponse.json({ error: "type must be 'skill' or 'soul'" }, { status: 400 });
  }
  if (!title || title.length < 1 || title.length > 100) {
    return NextResponse.json({ error: "title required (1-100 chars)" }, { status: 400 });
  }
  if (!description || description.length < 1 || description.length > 500) {
    return NextResponse.json({ error: "description required (1-500 chars)" }, { status: 400 });
  }
  if (typeof price !== "number" || price < 1000 || price > 1_000_000_000) {
    return NextResponse.json(
      { error: "price required in USDC micro-units (min $0.001 = 1000)" },
      { status: 400 }
    );
  }
  if (!content || content.length < 10 || content.length > 50_000) {
    return NextResponse.json({ error: "content required (10-50000 chars)" }, { status: 400 });
  }

  await ensureUser(address);
  const id = await createListing({
    sellerAddress: address,
    type,
    title,
    description,
    price,
    content,
  });

  return NextResponse.json({ id }, { status: 201 });
}
