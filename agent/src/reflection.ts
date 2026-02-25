import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { saveMemory, searchMemory, listMemoryKeys } from "./memory.js";
import { getEvolutionStats } from "./evolution.js";
import { getPlaybookStats, getAllBullets, loadPlaybook } from "./playbook.js";
import { getPrincipleStats, listAllPrinciples } from "./principles.js";

const MAX_RECENT_OUTCOMES = 10;
const MAX_RECENT_REFLECTIONS = 5;

export interface TaskOutcome {
  task: string;
  result: string;
  skillsUsed: string[];
  success: boolean;
  timestamp: number;
  reflectionSummary?: string;
}

export function saveOutcome(outcome: TaskOutcome) {
  const key = `outcome:${outcome.timestamp}`;
  saveMemory(key, JSON.stringify(outcome), "context");
}

export function getRecentOutcomes(limit = MAX_RECENT_OUTCOMES): TaskOutcome[] {
  const keys = listMemoryKeys("context")
    .filter((k) => k.startsWith("outcome:"))
    .sort()
    .reverse()
    .slice(0, limit);

  const outcomes: TaskOutcome[] = [];
  for (const key of keys) {
    const mem = searchMemory(key, { category: "context", limit: 1 });
    if (mem.length > 0) {
      try {
        outcomes.push(JSON.parse(mem[0].content));
      } catch {
        /* skip malformed */
      }
    }
  }
  return outcomes;
}

export function getRecentReflections(limit = MAX_RECENT_REFLECTIONS): string[] {
  const keys = listMemoryKeys("context")
    .filter((k) => k.startsWith("reflection:"))
    .sort()
    .reverse()
    .slice(0, limit);

  const reflections: string[] = [];
  for (const key of keys) {
    const mem = searchMemory(key, { category: "context", limit: 1 });
    if (mem.length > 0) {
      reflections.push(mem[0].content);
    }
  }
  return reflections;
}

export function buildReflectionPrompt(
  task: string,
  result: string,
  skillsUsed: string[]
): string {
  const recentOutcomes = getRecentOutcomes(5);
  const playbookStats = getPlaybookStats(loadPlaybook());
  const principleStats = getPrincipleStats();
  const bullets = getAllBullets(loadPlaybook());
  const bulletSummary =
    bullets.length > 0
      ? bullets
          .slice(0, 10)
          .map((b) => `[${b.id}] helpful=${b.helpful} harmful=${b.harmful} :: ${b.content}`)
          .join("\n")
      : "No playbook bullets yet.";

  const outcomeSummary =
    recentOutcomes.length > 0
      ? recentOutcomes
          .map(
            (o) =>
              `- [${o.success ? "OK" : "FAIL"}] "${o.task.slice(0, 80)}" (skills: ${o.skillsUsed.join(", ") || "none"})`
          )
          .join("\n")
      : "No previous outcomes.";

  return `You just completed a task. Reflect on what happened and distill a reusable principle.

## Task
${task}

## Result
${result.slice(0, 1000)}

## Skills Used
${skillsUsed.length > 0 ? skillsUsed.join(", ") : "None"}

## Recent History
${outcomeSummary}

## Your Current Playbook (${playbookStats.totalBullets} bullets, ${principleStats.total} principles)
${bulletSummary}

## Instructions
1. Assess: Did the task succeed? Rate confidence 1-5.
2. Learn: What worked well? What could be improved?
3. Distill: Extract ONE reusable strategic principle from this interaction. Is it a guiding principle (do this next time) or a cautionary principle (avoid this)?
4. Tag: Which playbook bullets did you use during this task? Were they helpful, harmful, or neutral?
5. Preferences: Did you learn anything new about the user?

Respond with a brief JSON object:
{
  "success": true/false,
  "confidence": 1-5,
  "learning": "what you learned",
  "principle": {
    "type": "guiding" or "cautionary",
    "description": "one-sentence reusable principle"
  },
  "bulletTags": [
    {"id": "str-00001", "tag": "helpful"},
    {"id": "err-00002", "tag": "harmful"}
  ],
  "userPreference": "any new preference learned about the user (optional)"
}`;
}

export function buildCuratorPrompt(): string {
  const playbook = loadPlaybook();
  const stats = getPlaybookStats(playbook);
  const principles = listAllPrinciples().slice(0, 10);
  const outcomes = getRecentOutcomes(10);
  const reflections = getRecentReflections(5);

  const principlesSummary =
    principles.length > 0
      ? principles
          .map(
            (p) =>
              `- [${p.type}] (score: ${p.metricScore.toFixed(2)}, used ${p.usageCount}x) ${p.description}`
          )
          .join("\n")
      : "No principles learned yet.";

  const outcomesSummary =
    outcomes.length > 0
      ? outcomes
          .map(
            (o) =>
              `- [${o.success ? "OK" : "FAIL"}] "${o.task.slice(0, 60)}" (skills: ${o.skillsUsed.join(", ") || "none"})`
          )
          .join("\n")
      : "No recent outcomes.";

  const reflectionsSummary =
    reflections.length > 0
      ? reflections.slice(0, 3).map((r) => `- ${r.slice(0, 150)}`).join("\n")
      : "No recent reflections.";

  return `You are reviewing your agent's performance to improve its playbook — the adaptive section of your system prompt that guides decision-making.

## Current Playbook
${playbook}

## Playbook Stats
- Total bullets: ${stats.totalBullets}
- High-performing (helpful>5, harmful<2): ${stats.highPerforming}
- Problematic (harmful>=helpful): ${stats.problematic}
- Unused: ${stats.unused}
- Approximate tokens: ${stats.approxTokens}
- Token budget: 4000

## Learned Principles
${principlesSummary}

## Recent Task Outcomes
${outcomesSummary}

## Recent Reflections
${reflectionsSummary}

## Instructions
Review the above and propose ADD operations to improve the playbook. Focus on:
1. Converting high-scoring principles into playbook bullets for persistent guidance
2. Adding routing heuristics based on task patterns
3. Adding domain knowledge from successful task outcomes
4. Adding user preference patterns

Rules:
- Only ADD operations (no deletions or rewrites)
- Each bullet max 200 characters
- Stay within the token budget
- Don't duplicate existing bullets

Respond with a JSON array of operations:
[
  {"type": "ADD", "section": "routing_heuristics", "content": "When user asks about yield..."},
  {"type": "ADD", "section": "common_mistakes_to_avoid", "content": "Never assume..."}
]

If no changes are needed, respond with an empty array: []`;
}

export function updateUserPreference(preference: string) {
  const userPath = join("/app/evolved-skills/identity", "USER.md");
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

export function buildEvolutionContext(): string {
  const outcomes = getRecentOutcomes(5);
  const reflections = getRecentReflections(3);
  const principleStats = getPrincipleStats();
  const playbookStats = getPlaybookStats(loadPlaybook());

  const parts: string[] = [];

  if (principleStats.total > 0 || playbookStats.totalBullets > 0) {
    parts.push(
      `## Self-Improvement Status
- ${principleStats.total} learned principles (${principleStats.guiding} guiding, ${principleStats.cautionary} cautionary, avg score: ${principleStats.avgScore.toFixed(2)})
- ${playbookStats.totalBullets} playbook bullets (${playbookStats.highPerforming} high-performing, ${playbookStats.problematic} problematic)`
    );
  }

  if (outcomes.length > 0) {
    parts.push(
      `## Recent Task Outcomes\n${outcomes.map((o) => `- [${o.success ? "OK" : "FAIL"}] "${o.task.slice(0, 60)}"`).join("\n")}`
    );
  }

  if (reflections.length > 0) {
    parts.push(
      `## Recent Reflections\n${reflections.slice(0, 2).map((r) => `- ${r.slice(0, 150)}`).join("\n")}`
    );
  }

  if (parts.length === 0) return "";
  return "\n\n" + parts.join("\n\n");
}
