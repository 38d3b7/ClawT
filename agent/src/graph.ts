import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

const GRAPH_CACHE_DIR = "/tmp/clawt-graph";
const REGISTRY_REPO = "https://github.com/38d3b7/eigenskills.git";
const CACHE_TTL = 10 * 60 * 1000;

const nodeCache = new Map<string, { content: string; fetchedAt: number }>();

function fetchGraphFile(filename: string): string {
  const localPath = process.env.SKILL_REGISTRY_LOCAL;
  if (localPath) {
    const filepath = join(localPath, "graph", filename);
    if (existsSync(filepath)) return readFileSync(filepath, "utf-8");
    throw new Error(`Graph node not found: ${filename}`);
  }

  if (!existsSync(GRAPH_CACHE_DIR)) {
    mkdirSync(GRAPH_CACHE_DIR, { recursive: true });
    execSync(
      `git clone --depth 1 --filter=blob:none --sparse ${REGISTRY_REPO} ${GRAPH_CACHE_DIR}`,
      { stdio: "pipe" }
    );
    execSync("git sparse-checkout set registry/graph", {
      cwd: GRAPH_CACHE_DIR,
      stdio: "pipe",
    });
  }

  const filepath = join(GRAPH_CACHE_DIR, "registry", "graph", filename);
  if (!existsSync(filepath)) {
    execSync("git pull --ff-only", { cwd: GRAPH_CACHE_DIR, stdio: "pipe" });
  }
  if (!existsSync(filepath)) throw new Error(`Graph node not found: ${filename}`);
  return readFileSync(filepath, "utf-8");
}

export function fetchGraphNode(nodeId: string): string {
  const safeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, "");
  const cached = nodeCache.get(safeId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.content;
  }
  const content = fetchGraphFile(`${safeId}.md`);
  nodeCache.set(safeId, { content, fetchedAt: Date.now() });
  return content;
}

export function fetchGraphIndex(): string {
  return fetchGraphNode("index");
}

export function resolveWikilinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
  return matches.map((m) => m.slice(2, -2));
}
