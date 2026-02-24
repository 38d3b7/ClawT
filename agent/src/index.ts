import express from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { getAgentAddress, signMessage } from "./wallet.js";
import { listSkills, listSkillsCatalog, fetchRegistry } from "./registry.js";
import { agentLoop, checkGrantStatus, callEigenAIText, setRuntimeEvolvedTools } from "./router.js";
import { executeSkill } from "./executor.js";
import { addLogEntry, getHistory } from "./logger.js";
import { validateInput, sanitizeOutput, validateSessionId } from "./security.js";
import { initMemory, getMemoryStats } from "./memory.js";
import { initHeartbeat, registerHeartbeat, listHeartbeats, listTasks } from "./heartbeat.js";
import { initEvolution, loadEvolvedTools, getEvolutionStats, getEvolutionLog } from "./evolution.js";
import {
  saveOutcome,
  buildReflectionPrompt,
  buildHeartbeatEvolutionPrompt,
  updateUserPreference,
} from "./reflection.js";

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
      console.warn(`[${requestId}] High injection risk (${validation.injectionRisk}): ${validation.warnings.join(", ")}`);
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
  const stats = getEvolutionStats();
  const log = getEvolutionLog().slice(-20);
  res.json({ stats, recentLog: log });
});

const CLAWT_ENV_KEYS = new Set([
  "MNEMONIC",
  "BACKEND_URL",
  "NETWORK_PUBLIC",
  "SKILL_REGISTRY_URL",
  "SKILL_REGISTRY_LOCAL",
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
    // Grant check failures are non-fatal in health endpoint
  }

  const evoStats = getEvolutionStats();

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
    evolution: evoStats,
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

  const evolvedTools = await loadEvolvedTools();
  setRuntimeEvolvedTools(evolvedTools);
  if (evolvedTools.length > 0) {
    console.log(`Loaded ${evolvedTools.length} evolved tools: ${evolvedTools.map(t => t.name).join(", ")}`);
  }

  initHeartbeat(async (prompt: string) => {
    const skills = await listSkills();
    const { response } = await agentLoop(prompt, skills);
    return response;
  });

  registerHeartbeat("grant-check", 6 * 60 * 60 * 1000, async () => {
    const status = await checkGrantStatus();
    console.log(`Grant status check: hasGrant=${status.hasGrant}, tokens=${status.tokenCount}`);
  });

  registerHeartbeat("evolve", 30 * 60 * 1000, async () => {
    try {
      const prompt = buildHeartbeatEvolutionPrompt();
      if (prompt.includes("Skip evolution")) return;
      const skills = await listSkills();
      const { response } = await agentLoop(prompt, skills);
      console.log("Evolution heartbeat:", response.slice(0, 200));
    } catch (err) {
      console.error("Evolution heartbeat failed:", err);
    }
  });

  await fetchRegistry().catch(console.error);
}

initialize().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Agent listening on 0.0.0.0:${PORT}`);
    console.log(`Wallet: ${getAgentAddress()}`);
  });
});
