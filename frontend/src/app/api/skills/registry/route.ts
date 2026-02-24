import { NextResponse } from "next/server";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/38d3b7/ClawT/main/registry.json";

let cache: { skills: RegistrySkill[]; fetchedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

interface RegistrySkill {
  id: string;
  description: string;
  version: string;
  author: string;
  contentHash: string;
  requiresEnv: string[];
  hasExecutionManifest: boolean;
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ skills: cache.skills });
  }

  const res = await fetch(REGISTRY_URL, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch skill registry" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { skills: RegistrySkill[] };
  cache = { skills: data.skills, fetchedAt: Date.now() };
  return NextResponse.json({ skills: data.skills });
}
