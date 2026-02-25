import { saveMemory, getMemory, listMemoryKeys, searchMemory } from "./memory.js";

const PRINCIPLE_PREFIX = "principle:";

export interface StrategicPrinciple {
  id: string;
  type: "guiding" | "cautionary";
  description: string;
  metricScore: number;
  usageCount: number;
  successCount: number;
  recentTaskIds: string[];
  createdAt: number;
}

function generatePrincipleId(): string {
  const hex = Math.random().toString(16).slice(2, 10);
  return `p_${hex}`;
}

export function savePrinciple(principle: StrategicPrinciple): void {
  saveMemory(`${PRINCIPLE_PREFIX}${principle.id}`, JSON.stringify(principle), "context");
}

export function getPrinciple(id: string): StrategicPrinciple | undefined {
  const mem = getMemory(`${PRINCIPLE_PREFIX}${id}`);
  if (!mem) return undefined;
  try {
    return JSON.parse(mem.content);
  } catch {
    return undefined;
  }
}

export function listAllPrinciples(): StrategicPrinciple[] {
  const keys = listMemoryKeys("context").filter((k) => k.startsWith(PRINCIPLE_PREFIX));
  const principles: StrategicPrinciple[] = [];
  for (const key of keys) {
    const mem = getMemory(key);
    if (!mem) continue;
    try {
      principles.push(JSON.parse(mem.content));
    } catch {
      continue;
    }
  }
  return principles.sort((a, b) => b.metricScore - a.metricScore);
}

export function retrieveRelevantPrinciples(taskText: string, limit = 5): StrategicPrinciple[] {
  const results = searchMemory(taskText, { category: "context", limit: limit * 3 });
  const principles: StrategicPrinciple[] = [];

  for (const entry of results) {
    if (!entry.key.startsWith(PRINCIPLE_PREFIX)) continue;
    try {
      principles.push(JSON.parse(entry.content));
    } catch {
      continue;
    }
    if (principles.length >= limit) break;
  }

  return principles.sort((a, b) => b.metricScore - a.metricScore);
}

export function findSimilarPrinciple(
  description: string,
  threshold = 0.4
): StrategicPrinciple | null {
  const words = new Set(description.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (words.size === 0) return null;

  let bestMatch: StrategicPrinciple | null = null;
  let bestScore = 0;

  for (const p of listAllPrinciples()) {
    const pWords = new Set(p.description.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    let overlap = 0;
    for (const w of words) {
      if (pWords.has(w)) overlap++;
    }
    const score = (2 * overlap) / (words.size + pWords.size);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = p;
    }
  }

  return bestMatch;
}

export function createPrinciple(
  type: "guiding" | "cautionary",
  description: string
): StrategicPrinciple {
  const existing = findSimilarPrinciple(description);
  if (existing) {
    existing.usageCount++;
    existing.metricScore = (existing.successCount + 1) / (existing.usageCount + 2);
    savePrinciple(existing);
    return existing;
  }

  const principle: StrategicPrinciple = {
    id: generatePrincipleId(),
    type,
    description,
    metricScore: 0.5,
    usageCount: 0,
    successCount: 0,
    recentTaskIds: [],
    createdAt: Date.now(),
  };
  savePrinciple(principle);
  return principle;
}

export function recordPrincipleUsage(
  principleId: string,
  taskId: string,
  success: boolean
): void {
  const p = getPrinciple(principleId);
  if (!p) return;

  p.usageCount++;
  if (success) p.successCount++;
  p.metricScore = (p.successCount + 1) / (p.usageCount + 2);

  p.recentTaskIds.push(taskId);
  if (p.recentTaskIds.length > 3) p.recentTaskIds.shift();

  savePrinciple(p);
}

export function formatPrinciplesForPrompt(principles: StrategicPrinciple[]): string {
  if (principles.length === 0) return "";

  const lines = principles.map((p) => {
    const scoreStr = p.metricScore.toFixed(2);
    const usedStr = p.usageCount > 0 ? `, used ${p.usageCount}x` : "";
    return `[${p.id}] ${p.type} (score: ${scoreStr}${usedStr}) :: ${p.description}`;
  });

  return `## LEARNED PRINCIPLES\n${lines.join("\n")}`;
}

export function getPrincipleStats(): {
  total: number;
  guiding: number;
  cautionary: number;
  avgScore: number;
} {
  const all = listAllPrinciples();
  const guiding = all.filter((p) => p.type === "guiding").length;
  const cautionary = all.filter((p) => p.type === "cautionary").length;
  const avgScore = all.length > 0 ? all.reduce((s, p) => s + p.metricScore, 0) / all.length : 0;
  return { total: all.length, guiding, cautionary, avgScore };
}
