import { NextResponse } from "next/server";

const GRANT_API = "https://determinal-api.eigenarcade.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid or missing address" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${GRANT_API}/message?address=${encodeURIComponent(address)}`
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch grant message" },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch grant message" },
      { status: 500 }
    );
  }
}
