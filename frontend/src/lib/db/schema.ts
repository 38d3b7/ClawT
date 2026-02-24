import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  address: text("address").primaryKey(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userAddress: text("user_address")
    .notNull()
    .references(() => users.address),
  appId: text("app_id"),
  ecloudName: text("ecloud_name"),
  name: text("name").notNull(),
  walletAddressEth: text("wallet_address_eth"),
  instanceIp: text("instance_ip"),
  status: text("status").default("deploying").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  sellerAddress: text("seller_address")
    .notNull()
    .references(() => users.address),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  buyerAddress: text("buyer_address")
    .notNull()
    .references(() => users.address),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  txHash: text("tx_hash").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
