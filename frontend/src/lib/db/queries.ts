import { eq, and, ne, desc, sql } from "drizzle-orm";
import { getDb } from "./client";
import { users, agents } from "./schema";
import type { Agent } from "./schema";

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
