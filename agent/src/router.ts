import type { Skill } from "./registry.js";
import { getAgentAddress, signMessage } from "./wallet.js";
import {
  getBalance,
  getUSDCBalance,
  transferETH,
  transferUSDC,
  transferERC20,
  sendRawTransaction,
  chainIdToNetwork,
  USDC_BASE_SEPOLIA,
  type SupportedChain,
  type TxReceipt,
} from "./wallet.js";
import { fetchGraphIndex, fetchGraphNode } from "./graph.js";
import { sanitizeOutput } from "./security.js";
import { saveMemory, searchMemory, listMemoryKeys, memoryTools } from "./memory.js";
import { scheduleTask, cancelTask, listTasks, schedulerTools } from "./heartbeat.js";
import type { MemoryCategory } from "./memory.js";
import { readSource, listSource, evolutionTools, getIdentityContext } from "./evolution.js";
import { browseListings, purchaseAndInstallSkill } from "./marketplace.js";
import { loadPlaybook, verifyCoreIdentity, setCoreIdentity, getCanonicalCoreIdentity } from "./playbook.js";
import { retrieveRelevantPrinciples, formatPrinciplesForPrompt } from "./principles.js";

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

const MAX_TRANSFER_USD = parseFloat(process.env.WALLET_MAX_TRANSFER_USD ?? "100");

const SUPPORTED_NETWORKS = [
  "sepolia",
  "base-sepolia",
  "base",
  "mainnet",
  "arbitrum",
  "optimism",
  "polygon",
];

const walletTools = [
  {
    type: "function" as const,
    function: {
      name: "check_balance",
      description: "Check ETH and USDC balances for the agent wallet on a given chain",
      parameters: {
        type: "object",
        properties: {
          network: {
            type: "string",
            enum: SUPPORTED_NETWORKS,
            description: "Network to check (default: base-sepolia)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transfer_eth",
      description: "Send ETH from the agent wallet to an address",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient address (0x...)" },
          amount: { type: "string", description: "Amount in ETH (e.g. '0.01')" },
          network: {
            type: "string",
            enum: SUPPORTED_NETWORKS,
            description: "Network (default: base-sepolia)",
          },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transfer_erc20",
      description: "Send ERC-20 tokens (e.g. USDC) from the agent wallet",
      parameters: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token name ('usdc') or contract address (0x...)",
          },
          to: { type: "string", description: "Recipient address (0x...)" },
          amount: {
            type: "string",
            description: "Amount in human units (e.g. '10.50' for 10.50 USDC)",
          },
          network: {
            type: "string",
            enum: SUPPORTED_NETWORKS,
            description: "Network (default: base-sepolia)",
          },
        },
        required: ["token", "to", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_transaction",
      description:
        "Sign, broadcast, and confirm an on-chain transaction. Accepts either a PayToll typed response (with type: ready/approval_required) or raw tx fields. For approval_required, sends approval first then main tx. Returns confirmed receipt with block number, gas used, and status.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["ready", "approval_required"],
            description:
              "PayToll response type. If omitted, treats as a raw tx using to/data/value/chain_id.",
          },
          transaction: {
            type: "object",
            description:
              "Main transaction object from PayToll response ({ to, data, value, chainId })",
            properties: {
              to: { type: "string" },
              data: { type: "string" },
              value: { type: "string" },
              chainId: { type: "number" },
            },
          },
          approval: {
            type: "object",
            description: "Approval transaction (only when type is approval_required)",
            properties: {
              to: { type: "string" },
              data: { type: "string" },
              value: { type: "string" },
              chainId: { type: "number" },
            },
          },
          to: { type: "string", description: "Target contract address (raw tx mode)" },
          data: { type: "string", description: "Encoded calldata (raw tx mode)" },
          value: { type: "string", description: "ETH value in wei (default: '0')" },
          chain_id: { type: "number", description: "Chain ID (raw tx mode)" },
        },
      },
    },
  },
];

const marketplaceTools = [
  {
    type: "function" as const,
    function: {
      name: "browse_marketplace",
      description:
        "Browse premium skills available for purchase on the CLAWT marketplace",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["skill", "soul"],
            description: "Type of listing to browse (default: skill)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "buy_marketplace_skill",
      description:
        "Purchase a skill from the marketplace by listing ID. Payment is handled automatically via x402 using USDC on Base Sepolia.",
      parameters: {
        type: "object",
        properties: {
          listing_id: {
            type: "string",
            description: "The listing ID to purchase",
          },
        },
        required: ["listing_id"],
      },
    },
  },
];

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
        .map(
          (t) =>
            `${t.name}: every ${t.intervalMs / 3600000}h (${t.enabled ? "enabled" : "disabled"})`
        )
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
    case "check_balance": {
      const { network } = args as { network?: SupportedChain };
      const net = network ?? "base-sepolia";
      const [eth, usdc] = await Promise.all([getBalance(net), getUSDCBalance(net)]);
      return `Wallet ${getAgentAddress()} on ${net}:\n  ETH: ${eth.eth}\n  USDC: ${usdc.formatted}`;
    }
    case "transfer_eth": {
      const { to, amount, network } = args as {
        to: string;
        amount: string;
        network?: SupportedChain;
      };
      const hash = await transferETH(
        to as `0x${string}`,
        amount,
        network ?? "base-sepolia"
      );
      return `Sent ${amount} ETH to ${to}\nTx: ${hash}`;
    }
    case "transfer_erc20": {
      const { token, to, amount, network } = args as {
        token: string;
        to: string;
        amount: string;
        network?: SupportedChain;
      };
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount > MAX_TRANSFER_USD) {
        return `Transfer rejected: amount ${amount} exceeds limit of ${MAX_TRANSFER_USD}`;
      }
      let hash: string;
      if (token.toLowerCase() === "usdc") {
        hash = await transferUSDC(
          to as `0x${string}`,
          amount,
          network ?? "base-sepolia"
        );
      } else {
        hash = await transferERC20(
          token as `0x${string}`,
          to as `0x${string}`,
          amount,
          network ?? "base-sepolia"
        );
      }
      return `Sent ${amount} ${token} to ${to}\nTx: ${hash}`;
    }
    case "send_transaction": {
      const typed = args as {
        type?: string;
        transaction?: { to: string; data: string; value?: string; chainId: number };
        approval?: { to: string; data: string; value?: string; chainId: number };
        to?: string;
        data?: string;
        value?: string;
        chain_id?: number;
      };

      async function execTx(tx: {
        to: string;
        data: string;
        value?: string;
        chainId: number;
      }): Promise<TxReceipt> {
        const net = chainIdToNetwork(tx.chainId);
        return sendRawTransaction(
          tx.to as `0x${string}`,
          tx.data as `0x${string}`,
          BigInt(tx.value ?? "0"),
          net
        );
      }

      function fmtReceipt(r: TxReceipt, label?: string): string {
        const prefix = label ? `[${label}] ` : "";
        return `${prefix}Tx: ${r.hash}\n  Status: ${r.status}\n  Block: ${r.blockNumber}\n  Gas: ${r.gasUsed}`;
      }

      if (typed.type === "approval_required" && typed.approval && typed.transaction) {
        const approvalReceipt = await execTx(typed.approval);
        if (approvalReceipt.status !== "success") {
          return `Approval transaction reverted.\n${fmtReceipt(approvalReceipt, "approval")}`;
        }
        const mainReceipt = await execTx(typed.transaction);
        const net = chainIdToNetwork(typed.transaction.chainId);
        return `Executed on ${net} (chain ${typed.transaction.chainId}):\n${fmtReceipt(approvalReceipt, "approval")}\n${fmtReceipt(mainReceipt, "main")}`;
      }

      if (typed.type === "ready" && typed.transaction) {
        const receipt = await execTx(typed.transaction);
        const net = chainIdToNetwork(typed.transaction.chainId);
        return `Executed on ${net} (chain ${typed.transaction.chainId}):\n${fmtReceipt(receipt)}`;
      }

      if (typed.to && typed.data && typed.chain_id) {
        const receipt = await execTx({
          to: typed.to,
          data: typed.data,
          value: typed.value,
          chainId: typed.chain_id,
        });
        const net = chainIdToNetwork(typed.chain_id);
        return `Executed on ${net} (chain ${typed.chain_id}):\n${fmtReceipt(receipt)}`;
      }

      return "send_transaction requires either { type, transaction } (PayToll format) or { to, data, chain_id } (raw format)";
    }
    case "browse_marketplace": {
      const { type } = args as { type?: "skill" | "soul" };
      const items = await browseListings(type ?? "skill");
      if (items.length === 0) return "No listings found.";
      return items
        .map(
          (l) =>
            `[${l.id}] ${l.title} — ${l.priceFormatted} USDC\n  ${l.description}`
        )
        .join("\n\n");
    }
    case "buy_marketplace_skill": {
      const { listing_id } = args as { listing_id: string };
      const { skillId } = await purchaseAndInstallSkill(listing_id);
      return `Purchased and installed skill "${skillId}". It is now available for execution.`;
    }
    default:
      return null;
  }
}

export async function agentLoop(
  task: string,
  availableSkills: Skill[],
  executeTool?: (name: string, args: unknown) => Promise<string>
): Promise<{ response: string; selectedSkillIds: string[] }> {
  const skillIndex = fetchGraphIndex();
  const identityContext = getIdentityContext();
  const playbook = loadPlaybook();
  const relevantPrinciples = retrieveRelevantPrinciples(task);
  const principlesBlock = formatPrinciplesForPrompt(relevantPrinciples);

  // --- Core Identity (immutable, VIGIL pattern) ---
  const coreIdentity = `You are an AI agent running in an EigenCompute TEE. You route tasks to skills and learn from experience.
${identityContext}

## Available Skills (via graph)
${skillIndex}

## Wallet
You have an on-chain wallet at ${getAgentAddress()}. You can check_balance, transfer_eth, and transfer_erc20 (including USDC) on Sepolia, Base Sepolia, Base, Ethereum mainnet, Arbitrum, Optimism, and Polygon. Use send_transaction to sign and broadcast raw transaction data returned by DeFi skills (e.g. aave-supply, swap-build).

## Marketplace
You can browse_marketplace to discover premium skills for purchase, and buy_marketplace_skill to acquire them. Payments are handled automatically via x402 using USDC on Base Sepolia.

## Memory
You can save and search information across sessions using save_memory and search_memory.

## Scheduling
You can schedule recurring tasks using schedule_task.

## Self-Awareness
You can read your own source code with read_source and list_source to understand how you work.

When you need to use skills, call select_skills with the skill IDs. You can explore_skills to learn more about a domain before selecting.`;

  if (!getCanonicalCoreIdentity()) {
    setCoreIdentity(coreIdentity);
  } else if (!verifyCoreIdentity(coreIdentity)) {
    console.warn("[security] Core identity mismatch detected — using canonical version");
  }

  // --- Adaptive Playbook (evolves via structured deltas) ---
  const adaptiveSection = `## ADAPTIVE PLAYBOOK
${playbook}

${principlesBlock}`;

  const systemPrompt = `${coreIdentity}\n\n${adaptiveSection}`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  const allTools = [
    SELECT_SKILLS_TOOL,
    EXPLORE_SKILLS_TOOL,
    ...walletTools,
    ...marketplaceTools,
    ...memoryTools,
    ...schedulerTools,
    ...evolutionTools,
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
