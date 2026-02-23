import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  verifySiwe,
  createSessionToken,
  requireAuth,
  getUserAddress,
  generateNonce,
} from "./auth.js";
import {
  ensureUser,
  createAgent,
  updateAgent,
  getAgentByUser,
} from "./db.js";
import {
  deployAgent,
  upgradeAgent,
  stopAgent,
  startAgent,
  terminateAgent,
  getAppInfo,
  runEcloudCommand,
  EIGENCOMPUTE_ENVIRONMENT,
} from "./eigencompute.js";
import { generateMnemonic } from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "50kb" }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000"] : []),
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

const PORT = parseInt(process.env.PORT ?? "3002", 10);
const AGENT_PORT = 3000;

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: "Too many auth attempts" },
});

const deployLimiter = rateLimit({
  windowMs: 3600_000,
  max: 10,
  message: { error: "Deploy limit reached" },
});

const envVarSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z][A-Z0-9_]*$/),
  value: z.string(),
  isPublic: z.boolean(),
});

const deployRequestSchema = z.object({
  name: z.string().min(1).max(64),
  envVars: z.array(envVarSchema),
  verifiable: z.boolean().optional().default(false),
});

app.get("/api/auth/nonce", authLimiter, (_req, res) => {
  res.json({ nonce: generateNonce() });
});

app.post("/api/auth/verify", authLimiter, async (req, res) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      res.status(400).json({ error: "Missing message/signature" });
      return;
    }
    const address = await verifySiwe(message, signature);
    ensureUser(address);
    const token = createSessionToken(address);
    const agent = getAgentByUser(address);
    const hasAgent = !!agent && agent.status !== "terminated";
    res.json({ address, token, hasAgent });
  } catch (error) {
    console.error("SIWE verification error:", error);
    res.status(401).json({ error: "Invalid signature" });
  }
});

app.post("/api/agents/deploy", deployLimiter, requireAuth, async (req, res) => {
  let agentId: number | undefined;
  try {
    const userAddress = getUserAddress(req);
    const parsed = deployRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }

    const { name, envVars, verifiable } = parsed.data;
    ensureUser(userAddress);

    const existing = getAgentByUser(userAddress);
    if (existing && existing.status !== "terminated") {
      res.status(409).json({ error: "You already have an active agent" });
      return;
    }

    agentId = createAgent(userAddress, name);
    const ecloudName = `clawt-${userAddress.slice(2, 10)}`;
    const mnemonic = generateMnemonic(english, 128);

    const systemVars = [
      { key: "MNEMONIC", value: mnemonic, isPublic: false },
      { key: "BACKEND_URL", value: process.env.BACKEND_PUBLIC_URL ?? "", isPublic: false },
      { key: "SKILL_REGISTRY_URL", value: process.env.SKILL_REGISTRY_URL ?? "", isPublic: true },
      { key: "NETWORK_PUBLIC", value: process.env.EIGENCOMPUTE_ENVIRONMENT === "mainnet-alpha" ? "mainnet" : "sepolia", isPublic: true },
    ];

    const userKeys = new Set(envVars.map((v) => v.key));
    const mergedEnvVars = [...systemVars.filter((sv) => !userKeys.has(sv.key)), ...envVars];

    updateAgent(agentId, { ecloud_name: ecloudName, status: "deploying" });

    const result = await deployAgent(ecloudName, mergedEnvVars, verifiable);

    updateAgent(agentId, {
      app_id: result.appId,
      wallet_address_eth: result.walletAddressEth,
      wallet_address_sol: result.walletAddressSol,
      instance_ip: result.instanceIp,
      docker_digest: result.dockerDigest,
      status: "running",
    });

    res.json({
      agentId,
      appId: result.appId,
      walletAddress: result.walletAddressEth,
      instanceIp: result.instanceIp,
    });
  } catch (error) {
    console.error("Deploy error:", error);
    if (agentId) updateAgent(agentId, { status: "terminated" });
    res.status(500).json({ error: "Deployment failed" });
  }
});

app.get("/api/agents/info", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent) {
      res.status(404).json({ error: "No agent found" });
      return;
    }

    if (agent.app_id && !agent.instance_ip) {
      try {
        const info = await getAppInfo(agent.app_id);
        if (info.instanceIp) {
          updateAgent(agent.id, { instance_ip: info.instanceIp });
          agent.instance_ip = info.instanceIp;
        }
      } catch { /* non-fatal */ }
    }

    res.json({
      name: agent.name,
      status: agent.status,
      appId: agent.app_id,
      walletAddressEth: agent.wallet_address_eth,
      walletAddressSol: agent.wallet_address_sol,
      instanceIp: agent.instance_ip,
      dockerDigest: agent.docker_digest,
      createdAt: agent.created_at,
      healthy: true,
    });
  } catch (error) {
    console.error("Info error:", error);
    res.status(500).json({ error: "Failed to get agent info" });
  }
});

app.post("/api/agents/stop", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.app_id) {
      res.status(404).json({ error: "No agent found" });
      return;
    }
    await stopAgent(agent.app_id);
    updateAgent(agent.id, { status: "stopped" });
    res.json({ success: true });
  } catch (error) {
    console.error("Stop error:", error);
    res.status(500).json({ error: "Failed to stop agent" });
  }
});

app.post("/api/agents/start", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.app_id) {
      res.status(404).json({ error: "No agent found" });
      return;
    }
    await startAgent(agent.app_id);
    updateAgent(agent.id, { status: "running" });
    res.json({ success: true });
  } catch (error) {
    console.error("Start error:", error);
    res.status(500).json({ error: "Failed to start agent" });
  }
});

app.post("/api/agents/terminate", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.app_id) {
      res.status(404).json({ error: "No agent found" });
      return;
    }
    await terminateAgent(agent.app_id);
    updateAgent(agent.id, { status: "terminated" });
    res.json({ success: true });
  } catch (error) {
    console.error("Terminate error:", error);
    res.status(500).json({ error: "Failed to terminate agent" });
  }
});

app.post("/api/agents/task", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.instance_ip || agent.status !== "running") {
      res.status(404).json({ error: "No running agent" });
      return;
    }

    const { task, sessionId } = req.body;
    if (!task) {
      res.status(400).json({ error: "Missing task" });
      return;
    }

    const agentRes = await fetch(`http://${agent.instance_ip}:${AGENT_PORT}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, sessionId }),
    });

    if (!agentRes.ok) {
      res.status(agentRes.status).json({ error: "Agent request failed" });
      return;
    }

    const result = await agentRes.json();
    res.json(result);
  } catch (error) {
    console.error("Task error:", error);
    res.status(500).json({ error: "Task execution failed" });
  }
});

app.get("/api/agents/skills", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.instance_ip) {
      res.status(404).json({ error: "No agent found" });
      return;
    }
    const agentRes = await fetch(`http://${agent.instance_ip}:${AGENT_PORT}/skills`);
    const result = await agentRes.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

app.get("/api/agents/history", requireAuth, async (req, res) => {
  try {
    const userAddress = getUserAddress(req);
    const agent = getAgentByUser(userAddress);
    if (!agent?.instance_ip) {
      res.status(404).json({ error: "No agent found" });
      return;
    }
    const agentRes = await fetch(`http://${agent.instance_ip}:${AGENT_PORT}/history`);
    const result = await agentRes.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

const GRANT_API = process.env.EIGENAI_GRANT_API ?? "https://determinal-api.eigenarcade.com";

app.get("/api/auth/grant", authLimiter, async (req, res) => {
  const address = typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid or missing address" });
    return;
  }
  try {
    const grantRes = await fetch(
      `${GRANT_API}/checkGrant?address=${encodeURIComponent(address)}`
    );
    if (!grantRes.ok) {
      res.json({ hasGrant: false, tokenCount: 0 });
      return;
    }
    const data = (await grantRes.json()) as { hasGrant?: boolean; tokenCount?: number };
    res.json({
      hasGrant: data.hasGrant ?? false,
      tokenCount: data.tokenCount ?? 0,
    });
  } catch (err) {
    console.error("Grant check proxy error:", err);
    res.json({ hasGrant: false, tokenCount: 0 });
  }
});

app.get("/api/auth/grant-message", authLimiter, async (req, res) => {
  const address = typeof req.query.address === "string" ? req.query.address.trim() : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid or missing address" });
    return;
  }
  try {
    const msgRes = await fetch(
      `${GRANT_API}/message?address=${encodeURIComponent(address)}`
    );
    if (!msgRes.ok) {
      res.status(msgRes.status).json({ error: "Failed to fetch grant message" });
      return;
    }
    const data = (await msgRes.json()) as Record<string, unknown>;
    res.json(data);
  } catch (err) {
    console.error("Grant message proxy error:", err);
    res.status(500).json({ error: "Failed to fetch grant message" });
  }
});

app.get("/api/billing/status", requireAuth, async (_req, res) => {
  try {
    const output = runEcloudCommand(
      `billing status --environment ${EIGENCOMPUTE_ENVIRONMENT}`
    );
    const active = /status:\s*active/i.test(output);
    const periodMatch = output.match(/period:\s*(.+)/i);
    const balanceMatch = output.match(/balance:\s*\$?([\d.]+)/i);
    const portalMatch = output.match(/(https:\/\/billing\.stripe\.com\S+)/);
    res.json({
      active,
      period: periodMatch?.[1]?.trim() ?? null,
      totalDue: balanceMatch?.[1] ?? "0.00",
      remainingCredits: "0.00",
      manageUrl: portalMatch?.[1] ?? null,
      needsSubscription: !active,
    });
  } catch (error) {
    console.error("Billing status error:", error);
    res.json({
      active: false,
      period: null,
      totalDue: "0.00",
      remainingCredits: "0.00",
      manageUrl: null,
      needsSubscription: true,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on 0.0.0.0:${PORT}`);
});
