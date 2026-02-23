export type MemoryCategory = "transactions" | "contracts" | "preferences" | "context";

export interface MemoryEntry {
  key: string;
  content: string;
  category: MemoryCategory;
  createdAt: number;
  updatedAt: number;
}

interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let backendUrl: string | null = null;
let persistenceEnabled = false;

export function initMemory(config: { backendUrl?: string }) {
  backendUrl = config.backendUrl ?? null;
  persistenceEnabled = !!backendUrl;
  if (persistenceEnabled) {
    loadFromBackend().catch(console.error);
  }
}

async function loadFromBackend(): Promise<void> {
  if (!backendUrl) return;
  try {
    const res = await fetch(`${backendUrl}/api/agents/memory`, {
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.entries)) {
        memoryStore.clear();
        for (const entry of data.entries) {
          memoryStore.set(entry.key, entry);
        }
      }
    }
  } catch (err) {
    console.error("Failed to load memory from backend:", err);
  }
}

async function persistToBackend(): Promise<void> {
  if (!backendUrl) return;
  try {
    await fetch(`${backendUrl}/api/agents/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: Array.from(memoryStore.values()) }),
    });
  } catch (err) {
    console.error("Failed to persist memory to backend:", err);
  }
}

export function saveMemory(
  key: string,
  content: string,
  category: MemoryCategory = "context"
): MemoryEntry {
  const now = Date.now();
  const existing = memoryStore.get(key);
  const entry: MemoryEntry = {
    key,
    content,
    category,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  memoryStore.set(key, entry);
  if (persistenceEnabled) {
    persistToBackend().catch(console.error);
  }
  return entry;
}

export function getMemory(key: string): MemoryEntry | undefined {
  return memoryStore.get(key);
}

export function deleteMemory(key: string): boolean {
  const deleted = memoryStore.delete(key);
  if (deleted && persistenceEnabled) {
    persistToBackend().catch(console.error);
  }
  return deleted;
}

export function listMemoryKeys(category?: MemoryCategory): string[] {
  const keys: string[] = [];
  for (const [key, entry] of memoryStore) {
    if (!category || entry.category === category) {
      keys.push(key);
    }
  }
  return keys;
}

export function searchMemory(
  query: string,
  options: { category?: MemoryCategory; limit?: number } = {}
): MemoryEntry[] {
  const { category, limit = 5 } = options;
  const queryLower = query.toLowerCase();
  const queryWords = new Set(queryLower.split(/\s+/).filter(w => w.length > 2));
  const results: SearchResult[] = [];
  const now = Date.now();

  for (const [key, entry] of memoryStore) {
    if (category && entry.category !== category) continue;

    let score = 0;

    if (key.toLowerCase() === queryLower) {
      score += 10;
    } else if (key.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    const contentLower = entry.content.toLowerCase();
    const contentWords = new Set(contentLower.split(/\s+/).filter(w => w.length > 2));
    let overlap = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) overlap++;
    }
    if (queryWords.size > 0) {
      score += (overlap / queryWords.size) * 4;
    }

    const ageHours = (now - entry.updatedAt) / (1000 * 60 * 60);
    if (ageHours < 24) {
      score += 1 - ageHours / 24;
    }

    if (score > 0) {
      results.push({ entry, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(r => r.entry);
}

export function clearMemory(): void {
  memoryStore.clear();
  if (persistenceEnabled) {
    persistToBackend().catch(console.error);
  }
}

export function getMemoryStats(): { count: number; categories: Record<MemoryCategory, number> } {
  const categories: Record<MemoryCategory, number> = {
    transactions: 0,
    contracts: 0,
    preferences: 0,
    context: 0,
  };
  for (const entry of memoryStore.values()) {
    categories[entry.category]++;
  }
  return { count: memoryStore.size, categories };
}

export const memoryTools = [
  {
    type: "function" as const,
    function: {
      name: "save_memory",
      description: "Save information to persistent memory. Use for contracts deployed, transactions executed, user preferences.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Unique identifier for this memory" },
          content: { type: "string", description: "The content to remember" },
          category: {
            type: "string",
            enum: ["transactions", "contracts", "preferences", "context"],
            description: "Category of memory"
          }
        },
        required: ["key", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_memory",
      description: "Search for relevant memories. Returns up to 5 most relevant entries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          category: {
            type: "string",
            enum: ["transactions", "contracts", "preferences", "context"],
            description: "Filter by category (optional)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "list_memory_keys",
      description: "List all memory keys, optionally filtered by category.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["transactions", "contracts", "preferences", "context"],
            description: "Filter by category (optional)"
          }
        }
      }
    }
  }
];
