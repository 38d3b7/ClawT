import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { saveMemory, searchMemory, listMemoryKeys } from "./memory.js";
import { getEvolutionStats, listEvolvedSkills, loadEvolvedTools } from "./evolution.js";

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
    .filter(k => k.startsWith("outcome:"))
    .sort()
    .reverse()
    .slice(0, limit);

  const outcomes: TaskOutcome[] = [];
  for (const key of keys) {
    const mem = searchMemory(key, { category: "context", limit: 1 });
    if (mem.length > 0) {
      try {
        outcomes.push(JSON.parse(mem[0].content));
      } catch { /* skip malformed */ }
    }
  }
  return outcomes;
}

export function getRecentReflections(limit = MAX_RECENT_REFLECTIONS): string[] {
  const keys = listMemoryKeys("context")
    .filter(k => k.startsWith("reflection:"))
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

export function buildReflectionPrompt(task: string, result: string, skillsUsed: string[]): string {
  const recentOutcomes = getRecentOutcomes(5);
  const evolvedTools = listMemoryKeys("context").filter(k => k.startsWith("evolved-tool-meta:"));
  const evolvedSkills = listEvolvedSkills();
  const stats = getEvolutionStats();

  const outcomeSummary = recentOutcomes.length > 0
    ? recentOutcomes.map(o =>
        `- [${o.success ? "OK" : "FAIL"}] "${o.task.slice(0, 80)}" (skills: ${o.skillsUsed.join(", ") || "none"})`
      ).join("\n")
    : "No previous outcomes.";

  return `You just completed a task. Reflect on what happened and how you can improve.

## Task
${task}

## Result
${result.slice(0, 1000)}

## Skills Used
${skillsUsed.length > 0 ? skillsUsed.join(", ") : "None"}

## Recent History
${outcomeSummary}

## Your Current Evolution
- ${stats.evolvedTools} synthesized tools
- ${evolvedSkills.length} created skills
- ${stats.totalModifications} total modifications

## Instructions
1. Assess: Did the task succeed? Rate confidence 1-5.
2. Learn: What worked well? What could be improved?
3. Evolve: Should you create a new tool or skill for tasks like this? If you've seen 3+ similar tasks, strongly consider synthesizing a reusable tool.
4. Remember: Save any important learnings to memory.

Respond with a brief JSON object:
{
  "success": true/false,
  "confidence": 1-5,
  "learning": "what you learned",
  "shouldSynthesizeTool": true/false,
  "toolIdea": "description if shouldSynthesizeTool is true",
  "userPreference": "any new preference learned about the user (optional)"
}`;
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
  const tools = listMemoryKeys("context").filter(k => k.startsWith("evolved-tool-meta:"));
  const skills = listEvolvedSkills();
  const stats = getEvolutionStats();

  const parts: string[] = [];

  if (stats.totalModifications > 0) {
    parts.push(`## Your Evolution (${stats.totalModifications} modifications)
- ${stats.evolvedTools} synthesized tools: ${tools.map(k => k.replace("evolved-tool-meta:", "")).join(", ") || "none"}
- ${skills.length} created skills: ${skills.map(s => s.id).join(", ") || "none"}`);
  }

  if (outcomes.length > 0) {
    parts.push(`## Recent Task Outcomes
${outcomes.map(o =>
  `- [${o.success ? "OK" : "FAIL"}] "${o.task.slice(0, 60)}"`
).join("\n")}`);
  }

  if (reflections.length > 0) {
    parts.push(`## Recent Reflections
${reflections.slice(0, 2).map(r => `- ${r.slice(0, 150)}`).join("\n")}`);
  }

  if (parts.length === 0) return "";
  return "\n\n" + parts.join("\n\n");
}

export function buildHeartbeatEvolutionPrompt(): string {
  const outcomes = getRecentOutcomes(10);
  const stats = getEvolutionStats();

  if (outcomes.length < 2) {
    return "No recent task history to analyze. Skip evolution this cycle.";
  }

  const taskTypes = new Map<string, number>();
  const failures: string[] = [];
  for (const o of outcomes) {
    const words = o.task.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
    taskTypes.set(words, (taskTypes.get(words) ?? 0) + 1);
    if (!o.success) failures.push(o.task.slice(0, 80));
  }

  const recurring = [...taskTypes.entries()]
    .filter(([, count]) => count >= 2)
    .map(([type, count]) => `"${type}..." (${count}x)`);

  return `You are reviewing your recent performance to evolve and improve.

## Stats
- ${outcomes.length} recent tasks
- ${outcomes.filter(o => o.success).length} succeeded, ${outcomes.filter(o => !o.success).length} failed
- ${stats.evolvedTools} tools synthesized, ${stats.totalModifications} total modifications

## Recurring Patterns
${recurring.length > 0 ? recurring.join("\n") : "No strong patterns yet."}

## Failures
${failures.length > 0 ? failures.map(f => `- "${f}"`).join("\n") : "No recent failures."}

## Instructions
1. If you see recurring task patterns (2+ occurrences), synthesize a tool to handle them more efficiently.
2. If you see repeated failures, investigate your own source code and consider what changes would help.
3. Consolidate old memories if the memory store is getting large.
4. You can read your source code, create tools, and create skills.

Act on your analysis. If nothing needs changing, just respond with your assessment.`;
}
