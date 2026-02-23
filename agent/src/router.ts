import type { Skill } from "./registry.js";
import { getAgentAddress, signMessage } from "./wallet.js";
import { fetchGraphIndex, fetchGraphNode } from "./graph.js";
import { sanitizeOutput } from "./security.js";
import { saveMemory, searchMemory, listMemoryKeys, memoryTools } from "./memory.js";
import { scheduleTask, cancelTask, listTasks, schedulerTools } from "./heartbeat.js";
import type { MemoryCategory } from "./memory.js";
import {
  readSource,
  listSource,
  synthesizeTool,
  createSkill,
  installPackage,
  writeEvolved,
  getEvolutionStats,
  loadEvolvedTools,
  evolutionTools,
  getIdentityContext,
  sanitizeToolOutput,
  type EvolvedToolDefinition,
} from "./evolution.js";
import { buildEvolutionContext } from "./reflection.js";

const GRANT_API = process.env.EIGENAI_GRANT_API ?? "https://determinal-api.eigenarcade.com";
const MODEL = process.env.AGENT_MODEL ?? "gpt-oss-120b-f16";
const MAX_TOKENS = parseInt(process.env.AGENT_MAX_TOKENS ?? "2048", 10);
const SEED = process.env.AGENT_SEED ? parseInt(process.env.AGENT_SEED, 10) : undefined;
const MAX_LOOP_TURNS = parseInt(process.env.AGENT_MAX_TURNS ?? "8", 10);

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

interface GrantAuth {
  message: string;
  signature: string;
  wallet: string;
}

let cachedGrant: GrantAuth | null = null;

async function getGrantAuth(): Promise<GrantAuth> {
  if (cachedGrant) return cachedGrant;

  const envMsg = process.env.EIGENAI_GRANT_MESSAGE;
  const envSig = process.env.EIGENAI_GRANT_SIGNATURE;
  const envWallet = process.env.EIGENAI_WALLET_ADDRESS;

  if (envMsg && envSig && envWallet) {
    cachedGrant = { message: envMsg, signature: envSig, wallet: envWallet };
    return cachedGrant;
  }

  const wallet = getAgentAddress();
  if (wallet === "0x0000000000000000000000000000000000000000") {
    throw new Error("No wallet available for grant auth");
  }

  const msgRes = await fetch(`${GRANT_API}/message?address=${wallet}`);
  if (!msgRes.ok) throw new Error(`Failed to fetch grant message: ${msgRes.status}`);
  const { message } = (await msgRes.json()) as { message: string };
  const signature = await signMessage(message);

  cachedGrant = { message, signature, wallet };
  return cachedGrant;
}

export async function checkGrantStatus(): Promise<{ hasGrant: boolean; tokenCount: number }> {
  try {
    const wallet = getAgentAddress();
    const res = await fetch(`${GRANT_API}/checkGrant?address=${wallet}`);
    if (!res.ok) return { hasGrant: false, tokenCount: 0 };
    const data = (await res.json()) as { hasGrant?: boolean; tokenCount?: number };
    return { hasGrant: data.hasGrant ?? false, tokenCount: data.tokenCount ?? 0 };
  } catch {
    return { hasGrant: false, tokenCount: 0 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEigenAI(
  messages: Array<{ role: string; content: string }>,
  tools?: unknown[]
): Promise<{ content: string; toolCalls?: Array<{ name: string; arguments: unknown }> }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const grant = await getGrantAuth();

      const body: Record<string, unknown> = {
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        grant_message: grant.message,
        grant_signature: grant.signature,
        wallet_address: grant.wallet,
      };

      if (SEED !== undefined) {
        body.seed = SEED;
      }

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const res = await fetch(`${GRANT_API}/api/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401 || res.status === 403) {
        cachedGrant = null;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error("Grant auth failed after retry");
      }

      if (res.status >= 500) {
        lastError = new Error(`EigenAI server error: ${res.status}`);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`EigenAI error: ${res.status} ${text}`);
      }

      const data = (await res.json()) as {
        choices: Array<{
          message: {
            content?: string;
            tool_calls?: Array<{ function: { name: string; arguments: string } }>;
          };
        }>;
      };

      const choice = data.choices[0]?.message;
      const toolCalls = choice?.tool_calls?.map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return { content: choice?.content ?? "", toolCalls };
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1 && lastError.message.includes("fetch")) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Max retries reached");
}

export async function callEigenAIText(prompt: string): Promise<string> {
  const result = await callEigenAI([{ role: "user", content: prompt }]);
  return result.content;
}

const SELECT_SKILLS_TOOL = {
  type: "function",
  function: {
    name: "select_skills",
    description: "Select skills to execute for this task",
    parameters: {
      type: "object",
      properties: {
        skill_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of skill IDs to execute",
        },
      },
      required: ["skill_ids"],
    },
  },
};

const EXPLORE_SKILLS_TOOL = {
  type: "function",
  function: {
    name: "explore_skills",
    description: "Explore the skill graph to learn about available capabilities",
    parameters: {
      type: "object",
      properties: {
        node_id: {
          type: "string",
          description: "Graph node ID to explore (e.g., 'defi', 'aave-lending')",
        },
      },
      required: ["node_id"],
    },
  },
};

let runtimeEvolvedTools: EvolvedToolDefinition[] = [];

export function setRuntimeEvolvedTools(tools: EvolvedToolDefinition[]) {
  runtimeEvolvedTools = tools;
}

async function executeBuiltInTool(
  name: string,
  args: Record<string, unknown>
): Promise<string | null> {
  switch (name) {
    case "save_memory": {
      const { key, content, category } = args as {
        key: string;
        content: string;
        category?: string;
      };
      const entry = saveMemory(key, content, category as MemoryCategory);
      return `Saved to memory: ${entry.key}`;
    }
    case "search_memory": {
      const { query, category } = args as { query: string; category?: string };
      const results = searchMemory(query, { category: category as MemoryCategory });
      if (results.length === 0) return "No matching memories found.";
      return results.map((r) => `[${r.category}] ${r.key}: ${r.content}`).join("\n");
    }
    case "list_memory_keys": {
      const { category } = args as { category?: string };
      const keys = listMemoryKeys(category as MemoryCategory);
      return keys.length > 0 ? `Memory keys: ${keys.join(", ")}` : "No memory entries.";
    }
    case "schedule_task": {
      const { name: taskName, interval_hours, task_prompt } = args as {
        name: string;
        interval_hours: number;
        task_prompt: string;
      };
      scheduleTask(taskName, interval_hours * 60 * 60 * 1000, task_prompt);
      return `Scheduled task "${taskName}" to run every ${interval_hours} hours.`;
    }
    case "cancel_task": {
      const { name: taskName } = args as { name: string };
      const canceled = cancelTask(taskName);
      return canceled ? `Canceled task "${taskName}".` : `Task "${taskName}" not found.`;
    }
    case "list_scheduled": {
      const tasks = listTasks();
      if (tasks.length === 0) return "No scheduled tasks.";
      return tasks
        .map((t) => `${t.name}: every ${t.intervalMs / 3600000}h (${t.enabled ? "enabled" : "disabled"})`)
        .join("\n");
    }
    case "read_source": {
      const { path } = args as { path: string };
      return readSource(path);
    }
    case "list_source": {
      const { directory } = args as { directory?: string };
      const files = listSource(directory);
      return files.length > 0 ? files.join("\n") : "No files found.";
    }
    case "synthesize_tool": {
      const { name: toolName, description, parameters, code } = args as {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        code: string;
      };
      const tool = await synthesizeTool(toolName, description, parameters, code);
      runtimeEvolvedTools.push(tool);
      return `Tool "${toolName}" synthesized and available immediately.`;
    }
    case "create_skill": {
      const { id, content } = args as { id: string; content: string };
      return createSkill(id, content);
    }
    case "install_package": {
      const { package_name } = args as { package_name: string };
      return installPackage(package_name);
    }
    case "write_evolved_file": {
      const { path, content } = args as { path: string; content: string };
      return writeEvolved(path, content);
    }
    case "evolution_status": {
      const stats = getEvolutionStats();
      return JSON.stringify(stats, null, 2);
    }
    default: {
      const evolvedTool = runtimeEvolvedTools.find((t) => t.name === name);
      if (evolvedTool) {
        const start = Date.now();
        console.log(`[evolved-tool:before] ${name} args=${JSON.stringify(args).slice(0, 200)}`);
        try {
          const result = await evolvedTool.handler(args);
          const elapsed = Date.now() - start;
          console.log(
            `[evolved-tool:after] ${name} ok=${result.length}b elapsed=${elapsed}ms`
          );
          return result;
        } catch (err) {
          const elapsed = Date.now() - start;
          console.error(
            `[evolved-tool:error] ${name} elapsed=${elapsed}ms err=${(err as Error).message}`
          );
          throw err;
        }
      }
      return null;
    }
  }
}

export async function agentLoop(
  task: string,
  availableSkills: Skill[],
  executeTool?: (name: string, args: unknown) => Promise<string>
): Promise<{ response: string; selectedSkillIds: string[] }> {
  const skillIndex = fetchGraphIndex();
  const evolutionContext = buildEvolutionContext();
  const identityContext = getIdentityContext();

  const evolvedToolDefs = runtimeEvolvedTools.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: `[evolved] ${t.description}`,
      parameters: t.parameters,
    },
  }));

  const systemPrompt = `You are a self-evolving AI agent running in an EigenCompute TEE. You route tasks to skills, and you can evolve by synthesizing new tools, creating skills, and reading your own source code.
${identityContext}

## Available Skills (via graph)
${skillIndex}

## Memory
You can save and search information across sessions using save_memory and search_memory.

## Scheduling
You can schedule recurring tasks using schedule_task.

## Evolution
You can read your own source code with read_source and list_source to understand how you work. You can synthesize_tool to create new reusable tools, create_skill for new skills, and install_package for new npm packages. Every modification you make is cryptographically signed and logged.

When you notice a pattern (doing the same kind of task repeatedly), consider synthesizing a tool to handle it more efficiently. You evolve by extending yourself, not by rewriting your core.
${evolutionContext}

When you need to use skills, call select_skills with the skill IDs. You can explore_skills to learn more about a domain before selecting.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  const allTools = [
    SELECT_SKILLS_TOOL,
    EXPLORE_SKILLS_TOOL,
    ...memoryTools,
    ...schedulerTools,
    ...evolutionTools,
    ...evolvedToolDefs,
  ];
  const selectedSkillIds: string[] = [];

  for (let turn = 0; turn < MAX_LOOP_TURNS; turn++) {
    const result = await callEigenAI(messages, allTools);

    if (!result.toolCalls || result.toolCalls.length === 0) {
      const sanitized = sanitizeOutput(result.content);
      return { response: sanitized, selectedSkillIds };
    }

    for (const tc of result.toolCalls) {
      let toolResult: string;

      try {
        if (tc.name === "select_skills") {
          const args = tc.arguments as { skill_ids: string[] };
          const validIds = args.skill_ids.filter((id) =>
            availableSkills.some((s) => s.id === id)
          );
          selectedSkillIds.push(...validIds);
          toolResult = `Selected skills: ${validIds.join(", ")}`;
        } else if (tc.name === "explore_skills") {
          const args = tc.arguments as { node_id: string };
          try {
            toolResult = fetchGraphNode(args.node_id);
          } catch {
            toolResult = `Node not found: ${args.node_id}`;
          }
        } else {
          const builtInResult = await executeBuiltInTool(
            tc.name,
            tc.arguments as Record<string, unknown>
          );
          if (builtInResult !== null) {
            toolResult = builtInResult;
          } else if (executeTool) {
            toolResult = await executeTool(tc.name, tc.arguments);
          } else {
            toolResult = `Unknown tool: ${tc.name}`;
          }
        }
      } catch (err) {
        const error = err as Error;
        toolResult = `Tool error (${tc.name}): ${error.message}`;
        console.error(`Tool ${tc.name} failed:`, error);
      }

      messages.push({ role: "tool", content: sanitizeOutput(toolResult) });
    }
  }

  return { response: "Max turns reached", selectedSkillIds };
}

export async function routeTask(
  task: string,
  availableSkills: Skill[]
): Promise<{ response: string; selectedSkillIds: string[] }> {
  return agentLoop(task, availableSkills);
}
