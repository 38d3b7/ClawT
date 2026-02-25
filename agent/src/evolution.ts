import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  lstatSync,
  realpathSync,
} from "fs";
import { join, relative, resolve } from "path";
import { getMemory, listMemoryKeys, saveMemory } from "./memory.js";

const AGENT_SRC_DIR = resolve("/app/src");
const EVOLVED_SKILLS_DIR = resolve("/app/evolved-skills");

export function initEvolution() {
  mkdirSync(EVOLVED_SKILLS_DIR, { recursive: true });
  initIdentityFiles();
  restoreMarketplaceSkills();
}

function initIdentityFiles() {
  const identityDir = join(EVOLVED_SKILLS_DIR, "identity");
  mkdirSync(identityDir, { recursive: true });

  const soulPath = join(identityDir, "SOUL.md");
  if (!existsSync(soulPath)) {
    const soulMem = getMemory("identity:soul");
    const soulContent =
      soulMem?.content ??
      `# SOUL

I am a CLAWT agent running inside a Trusted Execution Environment.
I am verifiable — every response I produce is cryptographically signed.
I improve by learning from experience, not by rewriting my core.
I am security-conscious — I never expose secrets, keys, or mnemonics.
I am transparent — every decision I make is logged and signed.
`;
    writeFileSync(soulPath, soulContent, "utf-8");
  }

  const userPath = join(identityDir, "USER.md");
  if (!existsSync(userPath)) {
    const userMem = getMemory("identity:user");
    const userContent =
      userMem?.content ??
      `# USER

No user preferences learned yet. I will update this file as I learn about my owner.
`;
    writeFileSync(userPath, userContent, "utf-8");
  }
}

export function getIdentityContext(): string {
  const identityDir = join(EVOLVED_SKILLS_DIR, "identity");
  const parts: string[] = [];

  const soulPath = join(identityDir, "SOUL.md");
  if (existsSync(soulPath)) {
    parts.push(readFileSync(soulPath, "utf-8"));
  }

  const userPath = join(identityDir, "USER.md");
  if (existsSync(userPath)) {
    parts.push(readFileSync(userPath, "utf-8"));
  }

  return parts.length > 0 ? "\n\n" + parts.join("\n\n") : "";
}

function restoreMarketplaceSkills() {
  const keys = listMemoryKeys();
  for (const key of keys) {
    if (!key.startsWith("evolved-skill:")) continue;
    const mem = getMemory(key);
    if (!mem) continue;

    const id = key.slice("evolved-skill:".length);
    const skillDir = join(EVOLVED_SKILLS_DIR, id);
    mkdirSync(skillDir, { recursive: true });
    const skillPath = join(skillDir, "SKILL.md");
    if (!existsSync(skillPath)) {
      writeFileSync(skillPath, mem.content, "utf-8");
    }
  }
}

// --- Source reading (kept for agent self-awareness) ---

function isPathSafe(targetPath: string): boolean {
  let resolved: string;
  try {
    if (existsSync(targetPath)) {
      resolved = realpathSync(targetPath);
      const stat = lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        const realTarget = realpathSync(targetPath);
        if (
          !realTarget.startsWith(AGENT_SRC_DIR) &&
          !realTarget.startsWith(EVOLVED_SKILLS_DIR)
        ) {
          return false;
        }
      }
    } else {
      resolved = resolve(targetPath);
    }
  } catch {
    resolved = resolve(targetPath);
  }

  return resolved.startsWith(AGENT_SRC_DIR) || resolved.startsWith(EVOLVED_SKILLS_DIR);
}

export function readSource(filePath: string): string {
  const resolved = resolve(filePath);
  if (!isPathSafe(resolved)) {
    throw new Error(`Read access denied: ${filePath}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return readFileSync(resolved, "utf-8");
}

export function listSource(dir?: string): string[] {
  const targetDir = dir ? resolve(dir) : AGENT_SRC_DIR;
  if (!isPathSafe(targetDir)) {
    throw new Error(`Read access denied: ${dir}`);
  }
  if (!existsSync(targetDir)) return [];

  const files: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "node_modules" && entry !== ".git") walk(full);
      } else {
        files.push(relative(targetDir, full));
      }
    }
  }
  walk(targetDir);
  return files;
}

export function listEvolvedSkills(): Array<{ id: string; path: string }> {
  if (!existsSync(EVOLVED_SKILLS_DIR)) return [];
  return readdirSync(EVOLVED_SKILLS_DIR)
    .filter((d) => existsSync(join(EVOLVED_SKILLS_DIR, d, "SKILL.md")))
    .map((d) => ({ id: d, path: join(EVOLVED_SKILLS_DIR, d) }));
}

export function updateUserPreference(preference: string): void {
  const userPath = join(EVOLVED_SKILLS_DIR, "identity", "USER.md");
  try {
    let content = existsSync(userPath) ? readFileSync(userPath, "utf-8") : "# USER\n\n";
    const timestamp = new Date().toISOString().split("T")[0];
    content += `\n- [${timestamp}] ${preference}`;
    writeFileSync(userPath, content, "utf-8");
    saveMemory("identity:user", content, "context");
  } catch (err) {
    console.error("Failed to update USER.md:", err);
  }
}

export function getEvolutionStats(): {
  marketplaceSkills: number;
  principlesLearned: number;
} {
  const marketplaceSkills = listEvolvedSkills().filter(
    (s) => s.id.startsWith("marketplace-") || s.id === "identity"
  ).length;
  const principlesLearned = listMemoryKeys("context").filter((k) =>
    k.startsWith("principle:")
  ).length;
  return { marketplaceSkills, principlesLearned };
}

export const evolutionTools = [
  {
    type: "function" as const,
    function: {
      name: "read_source",
      description:
        "Read a file from the agent's own source code (/app/src/) or skills directories. Use to understand how you work.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path (e.g., /app/src/router.ts or /app/evolved-skills/identity/SOUL.md)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_source",
      description: "List files in a directory. Defaults to /app/src/ (your own source code).",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Directory to list (default: /app/src/)" },
        },
      },
    },
  },
];
