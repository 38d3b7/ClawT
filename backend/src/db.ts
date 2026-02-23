import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.DB_DIR ?? join(__dirname, "..", "data");
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const db = new Database(join(DB_DIR, "clawt.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL REFERENCES users(address),
    app_id TEXT,
    ecloud_name TEXT,
    name TEXT NOT NULL,
    wallet_address_eth TEXT,
    wallet_address_sol TEXT,
    instance_ip TEXT,
    status TEXT DEFAULT 'deploying',
    docker_digest TEXT,
    env_vars TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_address);
`);

export interface Agent {
  id: number;
  user_address: string;
  app_id: string | null;
  ecloud_name: string | null;
  name: string;
  wallet_address_eth: string | null;
  wallet_address_sol: string | null;
  instance_ip: string | null;
  status: string;
  docker_digest: string | null;
  env_vars: string | null;
  created_at: string;
  updated_at: string;
}

export function ensureUser(address: string): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO users (address) VALUES (?)");
  stmt.run(address.toLowerCase());
}

export function createAgent(userAddress: string, name: string): number {
  const stmt = db.prepare(
    "INSERT INTO agents (user_address, name) VALUES (?, ?)"
  );
  const result = stmt.run(userAddress.toLowerCase(), name);
  return result.lastInsertRowid as number;
}

export function updateAgent(
  id: number,
  fields: Partial<Omit<Agent, "id" | "user_address" | "created_at">>
): void {
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`);
  stmt.run(...values);
}

export function getAgentByUser(userAddress: string): Agent | null {
  const stmt = db.prepare(
    "SELECT * FROM agents WHERE user_address = ? AND status != 'terminated' ORDER BY id DESC LIMIT 1"
  );
  return (stmt.get(userAddress.toLowerCase()) as Agent) ?? null;
}

export function getAgentById(id: number): Agent | null {
  const stmt = db.prepare("SELECT * FROM agents WHERE id = ?");
  return (stmt.get(id) as Agent) ?? null;
}
