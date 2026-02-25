import { saveMemory, getMemory } from "./memory.js";
import { signMessage } from "./wallet.js";

const PLAYBOOK_KEY = "playbook:current";
const PLAYBOOK_CANONICAL_KEY = "playbook:canonical-hash";
const MAX_BULLET_LENGTH = 200;
const MAX_PLAYBOOK_TOKENS_APPROX = 4000;
const CHARS_PER_TOKEN = 4;

export interface PlaybookBullet {
  id: string;
  helpful: number;
  harmful: number;
  content: string;
}

export interface PlaybookStats {
  totalBullets: number;
  highPerforming: number;
  problematic: number;
  unused: number;
  approxTokens: number;
}

export interface CuratorOperation {
  type: "ADD";
  section: string;
  content: string;
}

const SECTION_SLUGS: Record<string, string> = {
  strategies_and_insights: "str",
  routing_heuristics: "rte",
  common_mistakes_to_avoid: "err",
  domain_knowledge: "dom",
  user_preferences: "usr",
  composition_patterns: "cmp",
  others: "oth",
};

const EMPTY_PLAYBOOK = `## STRATEGIES & INSIGHTS

## ROUTING HEURISTICS

## COMMON MISTAKES TO AVOID

## DOMAIN KNOWLEDGE

## USER PREFERENCES

## COMPOSITION PATTERNS

## OTHERS`;

let nextBulletId = 1;

function sectionToSlug(section: string): string {
  const normalized = section.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return SECTION_SLUGS[normalized] ?? "oth";
}

export function parsePlaybookLine(line: string): PlaybookBullet | null {
  const match = line.match(/^\[([^\]]+)\]\s*helpful=(\d+)\s*harmful=(\d+)\s*::\s*(.*)$/);
  if (!match) return null;
  return {
    id: match[1],
    helpful: parseInt(match[2], 10),
    harmful: parseInt(match[3], 10),
    content: match[4],
  };
}

function formatBulletLine(b: PlaybookBullet): string {
  return `[${b.id}] helpful=${b.helpful} harmful=${b.harmful} :: ${b.content}`;
}

export function parsePlaybook(text: string): { sections: Map<string, PlaybookBullet[]>; raw: string } {
  const sections = new Map<string, PlaybookBullet[]>();
  let currentSection = "others";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed.slice(3).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }
    const bullet = parsePlaybookLine(trimmed);
    if (bullet) {
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      sections.get(currentSection)!.push(bullet);

      const numPart = bullet.id.match(/-(\d+)$/);
      if (numPart) {
        const n = parseInt(numPart[1], 10);
        if (n >= nextBulletId) nextBulletId = n + 1;
      }
    }
  }

  return { sections, raw: text };
}

export function updateBulletCounts(
  playbookText: string,
  tags: Array<{ id: string; tag: "helpful" | "harmful" | "neutral" }>
): string {
  const tagMap = new Map(tags.map((t) => [t.id, t.tag]));
  if (tagMap.size === 0) return playbookText;

  return playbookText
    .split("\n")
    .map((line) => {
      const bullet = parsePlaybookLine(line.trim());
      if (!bullet || !tagMap.has(bullet.id)) return line;
      const tag = tagMap.get(bullet.id)!;
      if (tag === "helpful") bullet.helpful++;
      else if (tag === "harmful") bullet.harmful++;
      return formatBulletLine(bullet);
    })
    .join("\n");
}

export function applyDeltaOperations(playbookText: string, operations: CuratorOperation[]): string {
  const adds = operations.filter((op) => op.type === "ADD");
  if (adds.length === 0) return playbookText;

  const newBullets = new Map<string, string[]>();
  for (const op of adds) {
    const content = op.content.slice(0, MAX_BULLET_LENGTH);
    const slug = sectionToSlug(op.section);
    const id = `${slug}-${String(nextBulletId++).padStart(5, "0")}`;
    const line = `[${id}] helpful=0 harmful=0 :: ${content}`;
    const sectionKey = op.section.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!newBullets.has(sectionKey)) newBullets.set(sectionKey, []);
    newBullets.get(sectionKey)!.push(line);
  }

  const lines = playbookText.split("\n");
  const result: string[] = [];
  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("## ")) {
      if (currentSection && newBullets.has(currentSection)) {
        result.push(...newBullets.get(currentSection)!);
        newBullets.delete(currentSection);
      }
      currentSection = trimmed.slice(3).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    result.push(lines[i]);
  }

  if (currentSection && newBullets.has(currentSection)) {
    result.push(...newBullets.get(currentSection)!);
    newBullets.delete(currentSection);
  }

  for (const [, bullets] of newBullets) {
    const othersIdx = result.findIndex((l) => l.trim().toLowerCase().startsWith("## others"));
    if (othersIdx >= 0) {
      result.splice(othersIdx + 1, 0, ...bullets);
    } else {
      result.push("## OTHERS", ...bullets);
    }
  }

  return result.join("\n");
}

export function getPlaybookStats(playbookText: string): PlaybookStats {
  let totalBullets = 0;
  let highPerforming = 0;
  let problematic = 0;
  let unused = 0;

  for (const line of playbookText.split("\n")) {
    const bullet = parsePlaybookLine(line.trim());
    if (!bullet) continue;
    totalBullets++;
    if (bullet.helpful > 5 && bullet.harmful < 2) highPerforming++;
    else if (bullet.harmful >= bullet.helpful && bullet.harmful > 0) problematic++;
    else if (bullet.helpful + bullet.harmful === 0) unused++;
  }

  return {
    totalBullets,
    highPerforming,
    problematic,
    unused,
    approxTokens: Math.ceil(playbookText.length / CHARS_PER_TOKEN),
  };
}

export function getAllBullets(playbookText: string): PlaybookBullet[] {
  const bullets: PlaybookBullet[] = [];
  for (const line of playbookText.split("\n")) {
    const bullet = parsePlaybookLine(line.trim());
    if (bullet) bullets.push(bullet);
  }
  return bullets;
}

export function isWithinTokenBudget(playbookText: string): boolean {
  return playbookText.length / CHARS_PER_TOKEN <= MAX_PLAYBOOK_TOKENS_APPROX;
}

// --- Core Identity Protection (VIGIL pattern) ---

let canonicalCoreIdentity: string | null = null;

export function setCoreIdentity(coreIdentity: string): void {
  canonicalCoreIdentity = coreIdentity;
  const hash = simpleHash(coreIdentity);
  saveMemory(PLAYBOOK_CANONICAL_KEY, hash, "context");
}

export function verifyCoreIdentity(currentCoreIdentity: string): boolean {
  if (!canonicalCoreIdentity) return true;
  return simpleHash(currentCoreIdentity) === simpleHash(canonicalCoreIdentity);
}

export function getCanonicalCoreIdentity(): string | null {
  return canonicalCoreIdentity;
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}

// --- Persistence ---

export function loadPlaybook(): string {
  const mem = getMemory(PLAYBOOK_KEY);
  if (mem) {
    const parsed = parsePlaybook(mem.content);
    void parsed;
    return mem.content;
  }
  return EMPTY_PLAYBOOK;
}

export async function savePlaybook(playbookText: string, action: string): Promise<void> {
  saveMemory(PLAYBOOK_KEY, playbookText, "context");
  try {
    const sig = await signMessage(JSON.stringify({ action, ts: Date.now() }));
    saveMemory(`playbook-log:${Date.now()}`, JSON.stringify({ action, signature: sig }), "context");
  } catch {
    // Signing optional in dev mode
  }
}

export function initPlaybook(): string {
  const existing = loadPlaybook();
  parsePlaybook(existing);
  return existing;
}
