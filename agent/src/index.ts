import express from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { getAgentAddress, signMessage } from "./wallet.js";
import { listSkills, listSkillsCatalog, fetchRegistry } from "./registry.js";
import { agentLoop, checkGrantStatus, callEigenAIText } from "./router.js";
import { executeSkill } from "./executor.js";
import { addLogEntry, getHistory } from "./logger.js";
import { validateInput, sanitizeOutput, validateSessionId } from "./security.js";
import { initMemory, getMemoryStats } from "./memory.js";
import { initHeartbeat, registerHeartbeat, listHeartbeats, listTasks } from "./heartbeat.js";
import { initEvolution, getEvolutionStats } from "./evolution.js";
import {
  saveOutcome,
  buildReflectionPrompt,
  buildCuratorPrompt,
  updateUserPreference,
} from "./reflection.js";
import { initPlaybook, loadPlaybook, updateBulletCounts, savePlaybook, getPlaybookStats } from "./playbook.js";
import { createPrinciple, getPrincipleStats, listAllPrinciples } from "./principles.js";
import type { CuratorOperation } from "./playbook.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const startTime = Date.now();
let lastErrorTime: number | null = null;

app.post("/task", async (req, res) => {
  const requestId = randomUUID();

  try {
    const { task, sessionId: rawSessionId } = req.body as { task: string; sessionId?: string };

    if (!task || typeof task !== "string") {
      res.status(400).json({ error: "Missing task", requestId });
      return;
    }

    const validation = validateInput(task);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error, requestId });
      return;
    }

    if (validation.injectionRisk > 0.5) {
      console.warn(
        `[${requestId}] High injection risk (${validation.injectionRisk}): ${validation.warnings.join(", ")}`
      );
    }

    const sessionId = validateSessionId(rawSessionId);

    const skills = await listSkills();
    const { response, selectedSkillIds } = await agentLoop(task, skills);

    let finalResult = response;
    const executedSkills: string[] = [];

    for (const skillId of selectedSkillIds) {
      try {
        const skillResult = await executeSkill(skillId, task);
        finalResult += `\n\n[${skillId}]: ${skillResult}`;
        executedSkills.push(skillId);
      } catch (err) {
        const error = err as Error;
        finalResult += `\n\n[${skillId} error]: ${error.message}`;
      }
    }

    finalResult = sanitizeOutput(finalResult);

    const agentAddress = getAgentAddress();
    const agentSignature = await signMessage(finalResult);
    const routingSignature = await signMessage(JSON.stringify(selectedSkillIds));

    await addLogEntry("task_completed", {
      requestId,
      task: task.slice(0, 200),
      skillsUsed: executedSkills,
      resultLength: finalResult.length,
    });

    res.json({
      result: finalResult,
      skillsUsed: executedSkills,
      agentAddress,
      agentSignature,
      routingSignature,
      sessionId,
      requestId,
    });

    setImmediate(async () => {
      try {
        const reflectionPrompt = buildReflectionPrompt(task, finalResult, executedSkills);
        const skills = await listSkills();
        const { response: reflectionResponse } = await agentLoop(reflectionPrompt, skills);

        let success = true;
        try {
          const parsed = JSON.parse(reflectionResponse);
          success = parsed.success !== false;

          if (parsed.learning) {
            const { saveMemory } = await import("./memory.js");
            saveMemory(`reflection:${Date.now()}`, parsed.learning, "context");
          }

          if (parsed.principle?.description) {
            createPrinciple(
              parsed.principle.type === "cautionary" ? "cautionary" : "guiding",
              parsed.principle.description
            );
          }

          if (parsed.bulletTags && Array.isArray(parsed.bulletTags)) {
            const playbook = loadPlaybook();
            const updated = updateBulletCounts(playbook, parsed.bulletTags);
            await savePlaybook(updated, "reflection_tag");
          }

          if (parsed.userPreference) {
            updateUserPreference(parsed.userPreference);
          }
        } catch {
          const { saveMemory } = await import("./memory.js");
          saveMemory(`reflection:${Date.now()}`, reflectionResponse.slice(0, 500), "context");
        }

        saveOutcome({
          task: task.slice(0, 200),
          result: finalResult.slice(0, 500),
          skillsUsed: executedSkills,
          success,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("Reflection failed:", err);
      }
    });
  } catch (err) {
    const error = err as Error;
    lastErrorTime = Date.now();
    console.error(`[${requestId}] Task error:`, error);
    res.status(500).json({ error: error.message, requestId });
  }
});

app.get("/skills", async (_req, res) => {
  try {
    const skills = await listSkills();
    res.json({ skills });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

app.get("/skills-catalog", async (_req, res) => {
  try {
    const catalog = await listSkillsCatalog();
    res.json({ skills: catalog });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

app.get("/history", (_req, res) => {
  res.json({ history: getHistory() });
});

app.get("/whoami", (_req, res) => {
  res.json({
    address: getAgentAddress(),
    network: process.env.NETWORK_PUBLIC ?? "sepolia",
    registryUrl: process.env.SKILL_REGISTRY_URL,
    tee: !!process.env.MNEMONIC,
  });
});

app.get("/evolution", (_req, res) => {
  const evoStats = getEvolutionStats();
  const playbookStats = getPlaybookStats(loadPlaybook());
  const principleStats = getPrincipleStats();
  const principles = listAllPrinciples().slice(0, 20);
  const playbook = loadPlaybook();

  res.json({
    stats: {
      ...evoStats,
      playbook: playbookStats,
      principles: principleStats,
    },
    playbook,
    principles,
  });
});

const CLAWT_ENV_KEYS = new Set([
  "MNEMONIC",
  "BACKEND_URL",
  "NETWORK_PUBLIC",
  "SKILL_REGISTRY_URL",
  "SKILL_REGISTRY_LOCAL",
  "MARKETPLACE_URL",
  "RPC_URL_SEPOLIA",
  "RPC_URL_BASE_SEPOLIA",
  "WALLET_MAX_TRANSFER_USD",
  "EIGENAI_GRANT_API",
  "EIGENAI_GRANT_MESSAGE",
  "EIGENAI_GRANT_SIGNATURE",
  "EIGENAI_WALLET_ADDRESS",
  "AGENT_MODEL",
  "AGENT_MAX_TOKENS",
  "AGENT_SEED",
  "AGENT_MAX_TURNS",
  "AGENT_SOUL",
  "SKILL_TIMEOUT_MS",
  "SKILL_MAX_BUFFER",
  "PORT",
]);

app.get("/env-export", (_req, res) => {
  const envVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && CLAWT_ENV_KEYS.has(k)) {
      envVars[k] = v;
    }
  }
  res.json({ envVars });
});

app.get("/health", async (_req, res) => {
  const uptimeMs = Date.now() - startTime;
  const memoryStats = getMemoryStats();
  const heartbeats = listHeartbeats();
  const tasks = listTasks();

  let grantStatus = { hasGrant: false, tokenCount: 0 };
  try {
    grantStatus = await checkGrantStatus();
  } catch {
    // Grant check failures are non-fatal
  }

  const evoStats = getEvolutionStats();
  const playbookStats = getPlaybookStats(loadPlaybook());
  const principleStats = getPrincipleStats();

  res.json({
    status: "ok",
    uptime: {
      ms: uptimeMs,
      formatted: formatUptime(uptimeMs),
    },
    grant: grantStatus,
    memory: memoryStats,
    scheduler: {
      heartbeats: heartbeats.length,
      tasks: tasks.length,
    },
    selfImprovement: {
      ...evoStats,
      playbook: playbookStats,
      principles: principleStats,
    },
    lastError: lastErrorTime ? new Date(lastErrorTime).toISOString() : null,
  });
});

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function initialize() {
  const backendUrl = process.env.BACKEND_URL;
  initMemory({ backendUrl });
  initEvolution();
  initPlaybook();

  initHeartbeat(async (prompt: string) => {
    const skills = await listSkills();
    const { response } = await agentLoop(prompt, skills);
    return response;
  });

  registerHeartbeat("grant-check", 6 * 60 * 60 * 1000, async () => {
    const status = await checkGrantStatus();
    console.log(`Grant status check: hasGrant=${status.hasGrant}, tokens=${status.tokenCount}`);
  });

  registerHeartbeat("phone-home", 5 * 60 * 1000, async () => {
    await registerWithBackend();
  });

  registerHeartbeat("playbook-curator", 2 * 60 * 60 * 1000, async () => {
    try {
      const curatorPrompt = buildCuratorPrompt();
      const skills = await listSkills();
      const { response } = await agentLoop(curatorPrompt, skills);

      try {
        const operations: CuratorOperation[] = JSON.parse(response);
        if (Array.isArray(operations) && operations.length > 0) {
          const { applyDeltaOperations } = await import("./playbook.js");
          const playbook = loadPlaybook();
          const updated = applyDeltaOperations(playbook, operations);
          await savePlaybook(updated, "curator_update");
          console.log(`Playbook curator: applied ${operations.length} operations`);
        }
      } catch {
        console.log("Playbook curator: no changes needed");
      }
    } catch (err) {
      console.error("Playbook curator failed:", err);
    }
  });

  await fetchRegistry().catch(console.error);
}

async function discoverPublicIp(): Promise<string> {
  let ip = "";
  try {
    const res = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(5_000) });
    if (res.ok) ip = (await res.text()).trim();
  } catch { /* non-fatal */ }

  if (ip) {
    try {
      const selfCheck = await fetch(`http://${ip}:${PORT}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (!selfCheck.ok) console.warn(`[heartbeat] Self-check returned ${selfCheck.status} for ${ip}`);
    } catch {
      console.warn(`[heartbeat] Self-check unreachable for ${ip} (NAT hairpin likely), sending IP anyway`);
    }
  }
  return ip;
}

async function registerWithBackend(): Promise<void> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return;

  const walletAddress = getAgentAddress();
  if (walletAddress === "0x0000000000000000000000000000000000000000") return;

  const instanceIp = await discoverPublicIp();

  const timestamp = Date.now().toString();
  const message = `clawt-agent-heartbeat:${walletAddress}:${timestamp}`;
  const signature = await signMessage(message);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${backendUrl}/api/agents/heartbeat-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, timestamp, signature, instanceIp }),
      });
      if (res.ok) {
        console.log(`Registered with backend${instanceIp ? ` (IP: ${instanceIp})` : ""}`);
        return;
      }
      console.warn(`Backend registration attempt ${attempt + 1} failed: ${res.status}`);
    } catch (err) {
      console.warn(`Backend registration attempt ${attempt + 1} error:`, err);
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
}

initialize().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Agent listening on 0.0.0.0:${PORT}`);
    console.log(`Wallet: ${getAgentAddress()}`);
    registerWithBackend().catch(console.error);
  });
});
