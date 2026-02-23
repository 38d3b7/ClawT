export interface Skill {
  id: string;
  description: string;
  version: string;
  author: string;
  contentHash: string;
  requiresEnv: string[];
  hasExecutionManifest: boolean;
}

export interface SkillCatalogEntry extends Skill {
  status: "enabled" | "disabled";
  missingEnvVars: string[];
}

const REGISTRY_URL =
  process.env.SKILL_REGISTRY_URL ??
  "https://raw.githubusercontent.com/38d3b7/eigenskills/main/registry/registry.json";

let cachedSkills: Skill[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function fetchRegistry(): Promise<Skill[]> {
  if (cachedSkills && Date.now() - cacheTime < CACHE_TTL) {
    return cachedSkills;
  }

  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`);
  const data = (await res.json()) as { skills: Skill[] };
  cachedSkills = data.skills;
  cacheTime = Date.now();
  return cachedSkills;
}

function getAvailableSkills(skills: Skill[]): Skill[] {
  return skills.filter((skill) =>
    skill.requiresEnv.every((key) => !!process.env[key])
  );
}

export async function listSkills(): Promise<Skill[]> {
  const all = await fetchRegistry();
  const remote = getAvailableSkills(all);

  try {
    const { listEvolvedSkills } = await import("./evolution.js");
    const evolved = listEvolvedSkills();
    for (const es of evolved) {
      if (!remote.some(s => s.id === es.id)) {
        remote.push({
          id: es.id,
          description: `[evolved] ${es.id}`,
          version: "local",
          author: "self",
          contentHash: "",
          requiresEnv: [],
          hasExecutionManifest: true,
        });
      }
    }
  } catch { /* evolution module not loaded yet */ }

  return remote;
}

export async function getSkill(id: string): Promise<Skill | undefined> {
  const all = await fetchRegistry();
  return all.find((s) => s.id === id);
}

export async function listSkillsCatalog(): Promise<SkillCatalogEntry[]> {
  const all = await fetchRegistry();
  return all.map((skill) => {
    const missingEnvVars = skill.requiresEnv.filter((key) => !process.env[key]);
    return {
      ...skill,
      status: missingEnvVars.length === 0 ? "enabled" : "disabled",
      missingEnvVars,
    };
  });
}
