import { NextResponse } from "next/server";
import { getAuthAddress, getRequestNetwork } from "@/lib/auth-server";
import { getAllAgentsForUser } from "@/lib/db/queries";

export async function GET(request: Request) {
  const address = getAuthAddress(request);
  if (!address) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await getAllAgentsForUser(address, getRequestNetwork(request));

  const nameMap: Record<string, string> = {};
  for (const a of agents) {
    if (a.appId) nameMap[a.appId.toLowerCase()] = a.name;
  }

  return NextResponse.json({ nameMap });
}
