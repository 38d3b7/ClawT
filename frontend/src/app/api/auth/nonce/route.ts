import { NextResponse } from "next/server";
import { generateNonce } from "@/lib/auth-server";

export async function GET() {
  return NextResponse.json({ nonce: generateNonce() });
}
