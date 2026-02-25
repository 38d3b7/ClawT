import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { computeManifestFromDir, rootHashToBytes32 } from "../../shared/manifest.js";
import { verifySkillSignature, type SkillSignature } from "../../shared/skill-signing.js";
import { getSkill } from "./registry.js";

const SKILLS_CACHE_DIR = "/tmp/clawt";
const EXEC_TIMEOUT_MS = parseInt(process.env.SKILL_TIMEOUT_MS ?? "30000", 10);
const EXEC_MAX_BUFFER = parseInt(process.env.SKILL_MAX_BUFFER ?? String(1024 * 1024), 10);
const SAFE_SKILL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

interface SkillManifest {
  name: string;
  description: string;
  version: string;
  author: string;
  requires_env?: string[];
  execution?: Array<{ run: string }>;
}

function validateSkillId(id: string): void {
  if (!SAFE_SKILL_ID_RE.test(id)) {
    throw new Error(`Invalid skill ID: ${id}`);
  }
}

const EVOLVED_SKILLS_DIR = "/app/evolved-skills";

function fetchSkillFolder(skillId: string): string {
  validateSkillId(skillId);

  const evolvedPath = join(EVOLVED_SKILLS_DIR, skillId);
  if (existsSync(join(evolvedPath, "SKILL.md"))) {
    return evolvedPath;
  }

  const localPath = process.env.SKILL_REGISTRY_LOCAL;
  if (localPath) {
    const skillPath = join(localPath, "skills", skillId);
    if (existsSync(skillPath)) return skillPath;
    throw new Error(`Skill not found locally: ${skillId}`);
  }

  const cacheDir = join(SKILLS_CACHE_DIR, skillId);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
    execSync(
      `git clone --depth 1 --filter=blob:none --sparse https://github.com/38d3b7/eigenskills.git ${cacheDir}`,
      { stdio: "pipe", timeout: 30000 }
    );
    execSync(`git sparse-checkout set registry/skills/${skillId}`, {
      cwd: cacheDir,
      stdio: "pipe",
    });
  }

  return join(cacheDir, "registry", "skills", skillId);
}

function buildSandboxedEnv(requiresEnv: string[]): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME ?? "/root",
    LANG: "en_US.UTF-8",
  };
  for (const key of requiresEnv) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

async function verifySkillIntegrity(
  skillId: string,
  skillPath: string
): Promise<void> {
  const registryEntry = await getSkill(skillId);
  const expectedHash = registryEntry?.contentHash;
  const hasSig = existsSync(join(skillPath, "SIGNATURE.json"));

  if (!expectedHash && !hasSig) return;

  const manifest = computeManifestFromDir(skillPath);

  if (expectedHash) {
    if (manifest.rootHash !== expectedHash) {
      throw new Error(
        `Integrity check failed for ${skillId}: expected ${expectedHash}, got ${manifest.rootHash}`
      );
    }
  }

  if (hasSig) {
    try {
      const sig: SkillSignature = JSON.parse(
        readFileSync(join(skillPath, "SIGNATURE.json"), "utf-8")
      );
      const manifestBytes32 = rootHashToBytes32(manifest.rootHash);

      if (sig.contentHash !== manifestBytes32) {
        throw new Error(
          `Signature contentHash mismatch for ${skillId}: ` +
            `signature says ${sig.contentHash}, files hash to ${manifestBytes32}`
        );
      }

      const valid = await verifySkillSignature(sig);
      if (!valid) {
        throw new Error(`Invalid signature for ${skillId}`);
      }

      console.log(`[verify] ${skillId}: signature valid (author: ${sig.author})`);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.warn(`[verify] ${skillId}: malformed SIGNATURE.json, skipping`);
      } else {
        throw err;
      }
    }
  }
}

export async function executeSkill(
  skillId: string,
  input: string
): Promise<string> {
  const skillPath = fetchSkillFolder(skillId);
  const manifestPath = join(skillPath, "SKILL.md");

  if (!existsSync(manifestPath)) {
    throw new Error(`SKILL.md not found for ${skillId}`);
  }

  await verifySkillIntegrity(skillId, skillPath);

  const manifestContent = readFileSync(manifestPath, "utf-8");
  const { data } = matter(manifestContent);
  const manifest = data as unknown as SkillManifest;

  if (!manifest.execution || manifest.execution.length === 0) {
    throw new Error(`No execution manifest for ${skillId}`);
  }

  const inputFile = "/tmp/skill-input.json";
  writeFileSync(inputFile, JSON.stringify({ input }));

  const env = buildSandboxedEnv(manifest.requires_env ?? []);
  let lastOutput = "";

  for (const step of manifest.execution) {
    const cmd = step.run
      .replace(/\{\{input\}\}/g, inputFile)
      .replace(/\{\{output\}\}/g, "/tmp/skill-output.txt");

    try {
      lastOutput = execSync(cmd, {
        cwd: skillPath,
        env,
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: EXEC_MAX_BUFFER,
        encoding: "utf-8",
      });
    } catch (err) {
      const error = err as { stderr?: string; message?: string };
      throw new Error(`Skill execution failed: ${error.stderr || error.message}`);
    }
  }

  return lastOutput.trim();
}
