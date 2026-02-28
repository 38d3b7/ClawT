import { eq, and, ne, desc, sql } from "drizzle-orm";
import { getDb } from "./client";
import { users, agents, listings, purchases } from "./schema";
import type { Agent, Listing, Purchase } from "./schema";

export async function ensureUser(address: string): Promise<void> {
  await getDb()
    .insert(users)
    .values({ address: address.toLowerCase() })
    .onConflictDoNothing();
}

export async function createAgent(
  userAddress: string,
  name: string
): Promise<number> {
  const result = await getDb()
    .insert(agents)
    .values({ userAddress: userAddress.toLowerCase(), name })
    .returning({ id: agents.id });
  return result[0].id;
}

export async function updateAgent(
  id: number,
  fields: Partial<
    Pick<Agent, "appId" | "ecloudName" | "name" | "walletAddressEth" | "instanceIp" | "status">
  >
): Promise<void> {
  await getDb()
    .update(agents)
    .set({ ...fields, updatedAt: sql`datetime('now')` })
    .where(eq(agents.id, id));
}

export async function getAgentByUser(
  userAddress: string
): Promise<Agent | null> {
  const rows = await getDb()
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.userAddress, userAddress.toLowerCase()),
        ne(agents.status, "terminated")
      )
    )
    .orderBy(desc(agents.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAgentById(id: number): Promise<Agent | null> {
  const rows = await getDb().select().from(agents).where(eq(agents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function terminateAllAgentsForUser(userAddress: string): Promise<number> {
  const result = await getDb()
    .update(agents)
    .set({ status: "terminated", updatedAt: sql`datetime('now')` })
    .where(
      and(
        eq(agents.userAddress, userAddress.toLowerCase()),
        ne(agents.status, "terminated")
      )
    );
  return result.rowsAffected ?? 0;
}

export async function getAllAgentsForUser(
  userAddress: string
): Promise<Pick<Agent, "appId" | "name" | "ecloudName" | "status">[]> {
  return getDb()
    .select({
      appId: agents.appId,
      name: agents.name,
      ecloudName: agents.ecloudName,
      status: agents.status,
    })
    .from(agents)
    .where(eq(agents.userAddress, userAddress.toLowerCase()))
    .orderBy(desc(agents.id));
}

// ── Marketplace ──

export type ListingPreview = Omit<Listing, "content" | "signature">;

export async function getActiveListings(
  type?: "skill" | "soul"
): Promise<ListingPreview[]> {
  const db = getDb();
  const cols = {
    id: listings.id,
    sellerAddress: listings.sellerAddress,
    type: listings.type,
    title: listings.title,
    description: listings.description,
    price: listings.price,
    status: listings.status,
    createdAt: listings.createdAt,
  };

  if (type) {
    return db
      .select(cols)
      .from(listings)
      .where(and(eq(listings.status, "active"), eq(listings.type, type)))
      .orderBy(desc(listings.createdAt));
  }
  return db
    .select(cols)
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.createdAt));
}

export async function getListingById(id: string): Promise<Listing | null> {
  const rows = await getDb()
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getListingsByUser(address: string): Promise<ListingPreview[]> {
  const db = getDb();
  return db
    .select({
      id: listings.id,
      sellerAddress: listings.sellerAddress,
      type: listings.type,
      title: listings.title,
      description: listings.description,
      price: listings.price,
      status: listings.status,
      createdAt: listings.createdAt,
    })
    .from(listings)
    .where(eq(listings.sellerAddress, address.toLowerCase()))
    .orderBy(desc(listings.createdAt));
}

export async function createListing(data: {
  sellerAddress: string;
  type: "skill" | "soul";
  title: string;
  description: string;
  price: number;
  content: string;
  signature?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await getDb()
    .insert(listings)
    .values({ id, ...data, sellerAddress: data.sellerAddress.toLowerCase() });
  return id;
}

export async function delistListing(id: string, ownerAddress: string): Promise<boolean> {
  const result = await getDb()
    .update(listings)
    .set({ status: "delisted" })
    .where(
      and(eq(listings.id, id), eq(listings.sellerAddress, ownerAddress.toLowerCase()))
    );
  return (result.rowsAffected ?? 0) > 0;
}

export async function hasPurchased(
  buyerAddress: string,
  listingId: string
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.buyerAddress, buyerAddress.toLowerCase()),
        eq(purchases.listingId, listingId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function recordPurchase(
  buyerAddress: string,
  listingId: string,
  txHash: string
): Promise<string> {
  const id = crypto.randomUUID();
  await getDb()
    .insert(purchases)
    .values({ id, buyerAddress: buyerAddress.toLowerCase(), listingId, txHash });
  return id;
}

export async function getPurchasesByUser(
  address: string,
  type?: "skill" | "soul"
): Promise<(Purchase & { listing: Listing })[]> {
  const rows = await getDb()
    .select()
    .from(purchases)
    .innerJoin(listings, eq(purchases.listingId, listings.id))
    .where(eq(purchases.buyerAddress, address.toLowerCase()))
    .orderBy(desc(purchases.createdAt));

  return rows
    .filter((r) => !type || r.listings.type === type)
    .map((r) => ({ ...r.purchases, listing: r.listings }));
}
