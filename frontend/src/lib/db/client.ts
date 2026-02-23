import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;

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
  }
  return _db;
}
