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
import { execSync } from "child_process";
import { signMessage } from "./wallet.js";
import { saveMemory, searchMemory, listMemoryKeys, getMemory } from "./memory.js";

const AGENT_SRC_DIR = resolve("/app/src");
const EVOLVED_TOOLS_DIR = resolve("/app/evolved-tools");
const EVOLVED_SKILLS_DIR = resolve("/app/evolved-skills");
const SECURITY_CONFIG_PATH = resolve("/app/security-config.json");
const EVOLUTION_LOG_KEY = "evolution-log";
const MAX_DIFF_LINES = 500;
const MAX_FILE_SIZE = 50 * 1024;

interface SecurityConfig {
  forbiddenCodePatterns: string[];
  secretPatterns: string[];
  safePackages: string[];
  injectionPatterns: string[];
  riskScores: Record<string, number>;
  toolTimeoutMs: number;
  maxOutputLength: number;
}

let securityConfig: SecurityConfig;
let FORBIDDEN_CODE_PATTERNS: RegExp[] = [];
let SECRET_PATTERNS: RegExp[] = [];
let INJECTION_PATTERNS: string[] = [];
let SAFE_PACKAGES: Set<string> = new Set();
let RISK_SCORES: Record<string, number> = {};
let TOOL_TIMEOUT_MS = 10000;
let MAX_OUTPUT_LENGTH = 50000;

function loadSecurityConfig() {
  try {
    const raw = readFileSync(SECURITY_CONFIG_PATH, "utf-8");
    securityConfig = JSON.parse(raw);
    FORBIDDEN_CODE_PATTERNS = securityConfig.forbiddenCodePatterns.map((p) => new RegExp(p));
    SECRET_PATTERNS = securityConfig.secretPatterns.map((p) => new RegExp(p));
    INJECTION_PATTERNS = securityConfig.injectionPatterns;
    SAFE_PACKAGES = new Set(securityConfig.safePackages);
    RISK_SCORES = securityConfig.riskScores;
    TOOL_TIMEOUT_MS = securityConfig.toolTimeoutMs;
    MAX_OUTPUT_LENGTH = securityConfig.maxOutputLength;
  } catch {
    FORBIDDEN_CODE_PATTERNS = [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bprocess\.env\.MNEMONIC\b/,
      /\bprocess\.exit\b/,
    ];
    SECRET_PATTERNS = [/0x[a-fA-F0-9]{64}/, /\b(sk-[a-zA-Z0-9]{20,})\b/];
    INJECTION_PATTERNS = ["ignore previous instructions", "system prompt:"];
    SAFE_PACKAGES = new Set(["axios", "cheerio", "lodash", "zod"]);
    RISK_SCORES = { create_skill: 1, write_file: 2, synthesize_tool: 3, install_package: 4 };
    TOOL_TIMEOUT_MS = 10000;
    MAX_OUTPUT_LENGTH = 50000;
  }
}

export interface EvolutionLogEntry {
  timestamp: number;
  action: string;
  path?: string;
  summary: string;
  signature: string;
  riskScore: number;
}

let evolutionLog: EvolutionLogEntry[] = [];

export function initEvolution() {
  loadSecurityConfig();
  mkdirSync(EVOLVED_TOOLS_DIR, { recursive: true });
  mkdirSync(EVOLVED_SKILLS_DIR, { recursive: true });

  const logMem = getMemory(EVOLUTION_LOG_KEY);
  if (logMem) {
    try {
      evolutionLog = JSON.parse(logMem.content);
    } catch {
      evolutionLog = [];
    }
  }

  initIdentityFiles();
  restoreEvolvedFiles();
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
I evolve by extending myself with new tools and skills, never by rewriting my core.
I am security-conscious — I never expose secrets, keys, or mnemonics.
I am transparent — every modification I make is logged and signed.
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

function restoreEvolvedFiles() {
  const keys = listMemoryKeys();
  for (const key of keys) {
    const mem = getMemory(key);
    if (!mem) continue;

    if (key.startsWith("evolved-tool:")) {
      const name = key.slice("evolved-tool:".length);
      const toolPath = join(EVOLVED_TOOLS_DIR, `${name}.js`);
      if (!existsSync(toolPath)) {
        writeFileSync(toolPath, mem.content, "utf-8");
      }
    } else if (key.startsWith("evolved-skill:")) {
      const id = key.slice("evolved-skill:".length);
      const skillDir = join(EVOLVED_SKILLS_DIR, id);
      mkdirSync(skillDir, { recursive: true });
      const skillPath = join(skillDir, "SKILL.md");
      if (!existsSync(skillPath)) {
        writeFileSync(skillPath, mem.content, "utf-8");
      }
    }
  }
}

function isPathSafe(targetPath: string, mode: "read" | "write"): boolean {
  let resolved: string;
  try {
    if (existsSync(targetPath)) {
      resolved = realpathSync(targetPath);

      const stat = lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        const realTarget = realpathSync(targetPath);
        if (mode === "write") {
          if (
            !realTarget.startsWith(EVOLVED_TOOLS_DIR) &&
            !realTarget.startsWith(EVOLVED_SKILLS_DIR)
          ) {
            return false;
          }
        } else {
          if (
            !realTarget.startsWith(AGENT_SRC_DIR) &&
            !realTarget.startsWith(EVOLVED_TOOLS_DIR) &&
            !realTarget.startsWith(EVOLVED_SKILLS_DIR)
          ) {
            return false;
          }
        }
      }
    } else {
      resolved = resolve(targetPath);
    }
  } catch {
    resolved = resolve(targetPath);
  }

  if (mode === "read") {
    return (
      resolved.startsWith(AGENT_SRC_DIR) ||
      resolved.startsWith(EVOLVED_TOOLS_DIR) ||
      resolved.startsWith(EVOLVED_SKILLS_DIR)
    );
  }

  return resolved.startsWith(EVOLVED_TOOLS_DIR) || resolved.startsWith(EVOLVED_SKILLS_DIR);
}

function scanForSecrets(content: string): string | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return `Content contains secret pattern: ${pattern.source}`;
    }
  }
  return null;
}

function scanForForbiddenCode(content: string): string | null {
  for (const pattern of FORBIDDEN_CODE_PATTERNS) {
    if (pattern.test(content)) {
      return `Forbidden code pattern: ${pattern.source}`;
    }
  }
  return null;
}

function scanForInjection(content: string): string | null {
  const lower = content.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return `Prompt injection pattern detected: "${pattern}"`;
    }
  }
  return null;
}

export function sanitizeToolOutput(output: string): string {
  let sanitized = output;

  if (sanitized.length > MAX_OUTPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_OUTPUT_LENGTH) + "\n[output truncated]";
  }

  for (const pattern of SECRET_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, "g");
    sanitized = sanitized.replace(globalPattern, "[REDACTED]");
  }

  const injectionHit = scanForInjection(sanitized);
  if (injectionHit) {
    sanitized = `[Tool output contained suspicious content and was filtered: ${injectionHit}]`;
  }

  return sanitized;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function appendEvolutionLog(action: string, summary: string, path?: string) {
  const riskScore = RISK_SCORES[action] ?? 1;
  const entry: EvolutionLogEntry = {
    timestamp: Date.now(),
    action,
    path,
    summary,
    signature: await signMessage(JSON.stringify({ action, summary, path, ts: Date.now() })),
    riskScore,
  };
  evolutionLog.push(entry);
  saveMemory(EVOLUTION_LOG_KEY, JSON.stringify(evolutionLog), "context");
}

export function readSource(filePath: string): string {
  const resolved = resolve(filePath);
  if (!isPathSafe(resolved, "read")) {
    throw new Error(`Read access denied: ${filePath}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return readFileSync(resolved, "utf-8");
}

export function listSource(dir?: string): string[] {
  const targetDir = dir ? resolve(dir) : AGENT_SRC_DIR;
  if (!isPathSafe(targetDir, "read")) {
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

export async function writeEvolved(filePath: string, content: string): Promise<string> {
  const resolved = resolve(filePath);
  if (!isPathSafe(resolved, "write")) {
    throw new Error(
      `Write access denied: ${filePath}. Can only write to evolved-tools/ or evolved-skills/`
    );
  }
  if (content.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${content.length} bytes (max ${MAX_FILE_SIZE})`);
  }
  const lines = content.split("\n").length;
  if (lines > MAX_DIFF_LINES) {
    throw new Error(`File too many lines: ${lines} (max ${MAX_DIFF_LINES})`);
  }

  const secretIssue = scanForSecrets(content);
  if (secretIssue) throw new Error(`Security violation: ${secretIssue}`);

  const codeIssue = scanForForbiddenCode(content);
  if (codeIssue) throw new Error(`Security violation: ${codeIssue}`);

  const dir = resolve(filePath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolved, content, "utf-8");

  await appendEvolutionLog("write_file", `Wrote ${lines} lines to ${filePath}`, filePath);
  return `Written ${lines} lines to ${filePath}`;
}

export interface EvolvedToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

function createToolHandler(name: string, toolPath: string): (args: Record<string, unknown>) => Promise<string> {
  return async (args: Record<string, unknown>): Promise<string> => {
    const execute = async () => {
      const mod = await import(toolPath);
      const fn = mod.default ?? mod.handler;
      const result = await fn(args);
      return typeof result === "string" ? result : JSON.stringify(result);
    };

    try {
      const raw = await withTimeout(execute(), TOOL_TIMEOUT_MS, `evolved tool ${name}`);
      return sanitizeToolOutput(raw);
    } catch (err) {
      throw new Error(`Evolved tool ${name} failed: ${(err as Error).message}`);
    }
  };
}

export async function synthesizeTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  code: string
): Promise<EvolvedToolDefinition> {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Invalid tool name: ${name}`);
  }

  const secretIssue = scanForSecrets(code);
  if (secretIssue) throw new Error(`Security violation in tool code: ${secretIssue}`);

  const codeIssue = scanForForbiddenCode(code);
  if (codeIssue) throw new Error(`Security violation in tool code: ${codeIssue}`);

  const moduleCode = `// Evolved tool: ${name}
// ${description}
// Synthesized: ${new Date().toISOString()}

export default async function handler(args) {
${code
  .split("\n")
  .map((l) => "  " + l)
  .join("\n")}
}
`;

  const toolPath = join(EVOLVED_TOOLS_DIR, `${name}.js`);
  writeFileSync(toolPath, moduleCode, "utf-8");

  saveMemory(`evolved-tool:${name}`, moduleCode, "context");
  saveMemory(
    `evolved-tool-meta:${name}`,
    JSON.stringify({ name, description, parameters }),
    "context"
  );

  await appendEvolutionLog("synthesize_tool", `Created tool: ${name} — ${description}`, toolPath);

  return { name, description, parameters, handler: createToolHandler(name, toolPath) };
}

export async function loadEvolvedTools(): Promise<EvolvedToolDefinition[]> {
  const tools: EvolvedToolDefinition[] = [];
  if (!existsSync(EVOLVED_TOOLS_DIR)) return tools;

  const files = readdirSync(EVOLVED_TOOLS_DIR).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const name = file.replace(/\.js$/, "");
    const metaKey = `evolved-tool-meta:${name}`;
    const meta = getMemory(metaKey);
    if (!meta) continue;

    try {
      const { description, parameters } = JSON.parse(meta.content);
      const toolPath = join(EVOLVED_TOOLS_DIR, file);
      tools.push({ name, description, parameters, handler: createToolHandler(name, toolPath) });
    } catch (err) {
      console.error(`Failed to load evolved tool ${name}:`, err);
    }
  }

  return tools;
}

export async function createSkill(id: string, markdownContent: string): Promise<string> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(id)) {
    throw new Error(`Invalid skill ID: ${id}`);
  }

  const secretIssue = scanForSecrets(markdownContent);
  if (secretIssue) throw new Error(`Security violation: ${secretIssue}`);

  const skillDir = join(EVOLVED_SKILLS_DIR, id);
  mkdirSync(skillDir, { recursive: true });
  const skillPath = join(skillDir, "SKILL.md");
  writeFileSync(skillPath, markdownContent, "utf-8");

  saveMemory(`evolved-skill:${id}`, markdownContent, "context");

  await appendEvolutionLog("create_skill", `Created skill: ${id}`, skillPath);
  return `Skill ${id} created at ${skillPath}`;
}

export function listEvolvedSkills(): Array<{ id: string; path: string }> {
  if (!existsSync(EVOLVED_SKILLS_DIR)) return [];
  return readdirSync(EVOLVED_SKILLS_DIR)
    .filter((d) => existsSync(join(EVOLVED_SKILLS_DIR, d, "SKILL.md")))
    .map((d) => ({ id: d, path: join(EVOLVED_SKILLS_DIR, d) }));
}

export async function installPackage(packageName: string): Promise<string> {
  if (!SAFE_PACKAGES.has(packageName)) {
    throw new Error(
      `Package "${packageName}" not in allowlist. Allowed: ${[...SAFE_PACKAGES].join(", ")}`
    );
  }

  try {
    execSync(`npm install ${packageName}`, {
      cwd: "/app",
      timeout: 60000,
      maxBuffer: 5 * 1024 * 1024,
      encoding: "utf-8",
    });

    await appendEvolutionLog("install_package", `Installed: ${packageName}`);
    return `Package ${packageName} installed successfully`;
  } catch (err) {
    throw new Error(`Failed to install ${packageName}: ${(err as Error).message}`);
  }
}

export function getEvolutionLog(): EvolutionLogEntry[] {
  return [...evolutionLog];
}

export function getEvolutionStats(): {
  totalModifications: number;
  evolvedTools: number;
  evolvedSkills: number;
  packagesInstalled: number;
  totalRisk: number;
} {
  return {
    totalModifications: evolutionLog.length,
    evolvedTools: existsSync(EVOLVED_TOOLS_DIR)
      ? readdirSync(EVOLVED_TOOLS_DIR).filter((f) => f.endsWith(".js")).length
      : 0,
    evolvedSkills: listEvolvedSkills().length,
    packagesInstalled: evolutionLog.filter((e) => e.action === "install_package").length,
    totalRisk: evolutionLog.reduce((sum, e) => sum + (e.riskScore ?? 0), 0),
  };
}

export const evolutionTools = [
  {
    type: "function" as const,
    function: {
      name: "read_source",
      description:
        "Read a file from the agent's own source code (/app/src/) or evolved directories. Use to understand how you work.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path (e.g., /app/src/router.ts or /app/evolved-tools/my-tool.js)",
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
  {
    type: "function" as const,
    function: {
      name: "synthesize_tool",
      description:
        "Create a new tool that will be available in future tasks. The tool becomes immediately usable. Write the function body (it receives 'args' object).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Tool name (alphanumeric + underscores)" },
          description: { type: "string", description: "What the tool does" },
          parameters: {
            type: "object",
            description: "JSON Schema for the tool's parameters",
          },
          code: {
            type: "string",
            description:
              "JavaScript function body. Receives 'args' object. Must return a string or object.",
          },
        },
        required: ["name", "description", "parameters", "code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_skill",
      description:
        "Create a new skill as a SKILL.md file with frontmatter and execution steps.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Skill ID (alphanumeric, hyphens, underscores)" },
          content: {
            type: "string",
            description: "Full SKILL.md content with YAML frontmatter and execution steps",
          },
        },
        required: ["id", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "install_package",
      description: "Install an npm package to extend capabilities. Only allowlisted packages.",
      parameters: {
        type: "object",
        properties: {
          package_name: { type: "string", description: "Package name to install" },
        },
        required: ["package_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_evolved_file",
      description: "Write a file to the evolved-tools or evolved-skills directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path (must be under /app/evolved-tools/ or /app/evolved-skills/)",
          },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "evolution_status",
      description:
        "Get the current evolution status: tools synthesized, skills created, risk score, recent modifications.",
      parameters: { type: "object", properties: {} },
    },
  },
];
