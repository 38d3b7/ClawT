import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { account } from "./wallet.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const MARKETPLACE_URL = process.env.MARKETPLACE_URL ?? "";
const EVOLVED_SKILLS_DIR = "/app/evolved-skills";

let payFetch: typeof fetch | null = null;

function getPayFetch(): typeof fetch {
  if (payFetch) return payFetch;
  if (!account) throw new Error("No wallet available for marketplace purchases");

  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(account));
  payFetch = wrapFetchWithPayment(fetch, client);
  return payFetch;
}

export interface MarketplaceListing {
  id: string;
  type: "skill" | "soul";
  title: string;
  description: string;
  price: number;
  priceFormatted: string;
  sellerAddress: string;
}

export async function browseListings(
  type: "skill" | "soul" = "skill"
): Promise<MarketplaceListing[]> {
  if (!MARKETPLACE_URL) throw new Error("MARKETPLACE_URL not configured");

  const res = await fetch(
    `${MARKETPLACE_URL}/api/marketplace/listings?type=${type}`
  );
  if (!res.ok) {
    throw new Error(`Failed to browse marketplace: ${res.status}`);
  }
  const data = (await res.json()) as { listings: MarketplaceListing[] };
  return data.listings;
}

export async function purchaseSkill(listingId: string): Promise<string> {
  if (!MARKETPLACE_URL) throw new Error("MARKETPLACE_URL not configured");

  const paidFetch = getPayFetch();
  const res = await paidFetch(
    `${MARKETPLACE_URL}/api/marketplace/listings/${listingId}/content`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Purchase failed (${res.status}): ${body}`);
  }

  const { content } = (await res.json()) as { content: string };
  return content;
}

export async function purchaseAndInstallSkill(
  listingId: string
): Promise<{ skillId: string; content: string }> {
  const content = await purchaseSkill(listingId);

  const skillId = `marketplace-${listingId.slice(0, 8)}`;
  const skillDir = join(EVOLVED_SKILLS_DIR, skillId);

  if (!existsSync(EVOLVED_SKILLS_DIR)) {
    mkdirSync(EVOLVED_SKILLS_DIR, { recursive: true });
  }
  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }

  writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");

  return { skillId, content };
}
