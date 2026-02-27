import { NextResponse } from "next/server";
import { getAuthAddress } from "@/lib/auth-server";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
  return NextResponse.json({ secret });
}
