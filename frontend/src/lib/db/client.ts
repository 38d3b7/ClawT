import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;
let _migrated = false;

async function ensureMigrations(client: Client) {
  if (_migrated) return;
  _migrated = true;
  try {
    await client.execute(
      "ALTER TABLE agents ADD COLUMN network TEXT NOT NULL DEFAULT 'sepolia'"
    );
  } catch {
    // Column already exists -- safe to ignore
  }
}

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not set");
    }
    const client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });
    _db = drizzle(client, { schema });
    ensureMigrations(client);
  }
  return _db;
}
