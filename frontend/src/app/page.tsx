"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  hasMetaMask,
  connectWallet,
  disconnectWallet,
  ensureWalletClient,
  signSiweMessage,
  signBillingAuth,
  signGrantMessage,
} from "@/lib/wallet";
import {
  verifyAuth,
  getAgentInfo,
  registerAgent,
  updateAgentStatus,
  submitTask,
  getGrantStatus,
  getBillingStatus,
  subscribeToBilling,
  getAgentHealth,
  getAgentEvolution,
  getAgentSkills,
  getAgentEnv,
  getAllAgents,
  terminateAgentById,
  dismissGhosts,
} from "@/lib/api";
import type {
  AgentInfo,
  HealthData,
  EvolutionData,
  PrincipleEntry,
  SkillInfo,
  StaleAgent,
  BillingDetail,
} from "@/lib/api";
import { STARTER_SOULS } from "@/lib/souls";
import type { Soul } from "@/lib/souls";
import { EIGEN_ENVIRONMENT, switchNetwork, type EigenEnvironment } from "@/lib/network-config";
import Link from "next/link";

type View = "landing" | "setup" | "dashboard" | "loading";
type DashboardTab = "overview" | "evolution" | "tools" | "identity" | "settings";

interface SiweCredentials {
  message: string;
  signature: string;
}

const SOUL_ICONS: Record<string, string> = {
  sparkle: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  palette: "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  code: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5",
};

function NetworkToggle({ compact }: { compact?: boolean }) {
  const isMainnet = EIGEN_ENVIRONMENT === "mainnet-alpha";
  const handleSwitch = (env: EigenEnvironment) => {
    if (env !== EIGEN_ENVIRONMENT) switchNetwork(env);
  };

  if (compact) {
    return (
      <button
        onClick={() => handleSwitch(isMainnet ? "sepolia" : "mainnet-alpha")}
        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
        title="Switch network"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${isMainnet ? "bg-green-500" : "bg-amber-500"}`} />
        {isMainnet ? "Mainnet" : "Sepolia"}
      </button>
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
      <button
        onClick={() => handleSwitch("sepolia")}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          !isMainnet
            ? "bg-amber-100 text-amber-800"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Sepolia
      </button>
      <button
        onClick={() => handleSwitch("mainnet-alpha")}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          isMainnet
            ? "bg-green-100 text-green-800"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Mainnet
      </button>
    </div>
  );
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function TokenBudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = Math.min((used / budget) * 100, 100);
  const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Playbook token budget</span>
        <span>{used.toLocaleString()} / {budget.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label?: string }) {
  const pct = Math.min(score * 100, 100);
  const color = score >= 0.7 ? "bg-emerald-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{label ?? score.toFixed(2)}</span>
    </div>
  );
}

function PlaybookSection({ title, bullets }: { title: string; bullets: Array<{ id: string; helpful: number; harmful: number; content: string }> }) {
  if (bullets.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1.5">
        {bullets.map((b) => (
          <div key={b.id} className="group flex items-start gap-2 rounded-md border border-border/50 px-3 py-2 transition-colors hover:border-border">
            <span className="mt-0.5 shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">{b.id}</span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed">{b.content}</p>
            <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
              <span className="text-emerald-600" title="Helpful">{b.helpful}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-500" title="Harmful">{b.harmful}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlaybookBullet {
  id: string;
  helpful: number;
  harmful: number;
  content: string;
  section: string;
}

function parsePlaybookForUI(text: string): { sections: Map<string, PlaybookBullet[]> } {
  const sections = new Map<string, PlaybookBullet[]>();
  let currentSection = "Others";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed.slice(3);
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      continue;
    }
    const match = trimmed.match(/^\[([^\]]+)\]\s*helpful=(\d+)\s*harmful=(\d+)\s*::\s*(.*)$/);
    if (match) {
      if (!sections.has(currentSection)) sections.set(currentSection, []);
      sections.get(currentSection)!.push({
        id: match[1],
        helpful: parseInt(match[2], 10),
        harmful: parseInt(match[3], 10),
        content: match[4],
        section: currentSection,
      });
    }
  }
  return { sections };
}

export default function Home() {
  const [view, setView] = useState<View>("loading");
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");
  const [agentName, setAgentName] = useState("");
  const [task, setTask] = useState("");
  const [result, setResult] = useState("");
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [selectedSoul, setSelectedSoul] = useState<Soul>(STARTER_SOULS[0]);
  const [billingActive, setBillingActive] = useState(false);
  const [billingManageUrl, setBillingManageUrl] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [grantStatus, setGrantStatus] = useState<{
    checked: boolean;
    hasGrant: boolean;
    tokenCount: number;
  }>({ checked: false, hasGrant: false, tokenCount: 0 });
  const [grantCredentials, setGrantCredentials] = useState<{
    message: string;
    signature: string;
    walletAddress: string;
  } | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [signingGrant, setSigningGrant] = useState(false);
  const [subscribingBilling, setSubscribingBilling] = useState(false);
  const [siweCredentials, setSiweCredentials] = useState<SiweCredentials | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [walletClients, setWalletClients] = useState<any>(null);
  const initRef = useRef(false);

  const [deployPhase, setDeployPhase] = useState<"idle" | "tx-pending" | "waiting-for-ip" | "ready" | "failed">("idle");
  const [agentHealthy, setAgentHealthy] = useState<boolean | null>(null);
  const [staleAgents, setStaleAgents] = useState<StaleAgent[]>([]);
  const [ghostAgents, setGhostAgents] = useState<StaleAgent[]>([]);
  const [cleaningUpId, setCleaningUpId] = useState<number | null>(null);
  const [eigenAccount, setEigenAccount] = useState<{
    activeCount: number;
    maxApps: number;
    apps: { appId: string; status: number }[];
  } | null>(null);
  const [eigenAccountLoading, setEigenAccountLoading] = useState(false);
  const [appNameMap, setAppNameMap] = useState<Record<string, string>>({});
  const [showTerminated, setShowTerminated] = useState(false);
  const [terminatingAppId, setTerminatingAppId] = useState<string | null>(null);
  const [deployDiag, setDeployDiag] = useState<{
    status?: string;
    ip?: string;
    derivedWallet?: string;
    machineType?: string;
    contractStatus?: string;
    error?: string;
  } | null>(null);
  const [deployDiagLoading, setDeployDiagLoading] = useState(false);

  const [dashTab, setDashTab] = useState<DashboardTab>("overview");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [purchasedSouls, setPurchasedSouls] = useState<Soul[]>([]);

  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [envRevealed, setEnvRevealed] = useState<Set<string>>(new Set());
  const [envNewKey, setEnvNewKey] = useState("");
  const [envNewValue, setEnvNewValue] = useState("");
  const [envLoading, setEnvLoading] = useState(false);
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState("");

  const [dashBilling, setDashBilling] = useState<BillingDetail | null>(null);
  const [dashBillingChecking, setDashBillingChecking] = useState(false);

  const SYSTEM_ENV_KEYS = new Set(["BACKEND_URL", "PORT"]);

  const envDirty =
    JSON.stringify(Object.keys(envDraft).sort().reduce((a, k) => ({ ...a, [k]: envDraft[k] }), {})) !==
    JSON.stringify(Object.keys(envVars).sort().reduce((a, k) => ({ ...a, [k]: envVars[k] }), {}));

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboardData = useCallback(
    async (t: string) => {
      const [h, e] = await Promise.all([getAgentHealth(t), getAgentEvolution(t)]);
      if (h) setHealth(h);
      if (e) setEvolution(e);
    },
    []
  );

  useEffect(() => {
    if (view !== "dashboard" || !token) return;

    const hasIp = !!agentInfo?.instanceIp;
    const pollMs = hasIp ? 15_000 : 5_000;

    if (hasIp) {
      fetchDashboardData(token);
      getAgentSkills(token).then(setSkills);
    }

    pollRef.current = setInterval(async () => {
      try {
        const info = await getAgentInfo(token);
        if (!info || info.status === "terminated") {
          setAgentInfo(null);
          setView("setup");
          return;
        }

        const justGotIp = !agentInfo?.instanceIp && info.instanceIp;
        setAgentInfo(info);
        setAgentHealthy(info.healthy);

        if (justGotIp || hasIp) {
          fetchDashboardData(token);
          if (justGotIp) getAgentSkills(token).then(setSkills);
        }
      } catch {
        // non-fatal: keep polling
      }
    }, pollMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [view, token, agentInfo?.instanceIp, agentInfo?.appId, agentInfo?.status, fetchDashboardData]);

  const checkAgent = useCallback(
    async (t: string) => {
      try {
        const [info] = await Promise.all([getAgentInfo(t), fetchStaleAgents(t)]);
        if (info && info.status !== "terminated") {
          setAgentInfo(info);
          setView("dashboard");
        } else {
          setView("setup");
        }
      } catch {
        setView("landing");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function checkBillingViaProxy(
    addr: `0x${string}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wc: any,
    t: string
  ): Promise<{ active: boolean; portalUrl?: string; error?: string }> {
    if (!wc || !t) return { active: false, error: "No wallet connected" };
    try {
      const auth = await signBillingAuth(addr, wc);
      return await getBillingStatus(t, auth);
    } catch (err) {
      return { active: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const runPreflightChecks = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (addr: string, wc: any, t: string) => {
      setCheckingPreflight(true);
      try {
        const [billing, grant] = await Promise.all([
          wc ? checkBillingViaProxy(addr as `0x${string}`, wc, t) : null,
          getGrantStatus(addr),
          fetchStaleAgents(t),
        ]);
        if (billing) {
          setBillingActive(billing.active);
          setBillingManageUrl(billing.portalUrl ?? null);
          setBillingError(billing.active ? null : (billing.error ?? null));
        }
        setGrantStatus({ checked: true, hasGrant: grant.hasGrant, tokenCount: grant.tokenCount });
      } catch {
        setBillingActive(false);
        setGrantStatus({ checked: true, hasGrant: false, tokenCount: 0 });
      } finally {
        setCheckingPreflight(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleCheckBilling() {
    setCheckingPreflight(true);
    setError("");
    try {
      let wc = walletClients;
      if (!wc) {
        const result = await ensureWalletClient();
        wc = { walletClient: result.walletClient, publicClient: result.publicClient, address: result.address as `0x${string}` };
        setWalletClients(wc);
      }
      const auth = await signBillingAuth(wc.address, wc.walletClient);
      const billing = await getBillingStatus(token, auth);
      setBillingActive(billing.active);
      setBillingManageUrl(billing.portalUrl ?? null);
      setBillingError(billing.active ? null : (billing.error ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingPreflight(false);
    }
  }

  async function handleSubscribeBilling() {
    setSubscribingBilling(true);
    setError("");
    try {
      let wc = walletClients;
      if (!wc) {
        const result = await ensureWalletClient();
        wc = { walletClient: result.walletClient, publicClient: result.publicClient, address: result.address as `0x${string}` };
        setWalletClients(wc);
      }
      const auth = await signBillingAuth(wc.address, wc.walletClient);
      const res = await subscribeToBilling(token, auth);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res.alreadyActive) {
        setBillingActive(true);
        return;
      }
      setError("Could not get checkout URL. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubscribingBilling(false);
    }
  }

  async function handleDashBillingCheck() {
    setDashBillingChecking(true);
    try {
      let wc = walletClients;
      if (!wc) {
        const result = await ensureWalletClient();
        wc = { walletClient: result.walletClient, publicClient: result.publicClient, address: result.address as `0x${string}` };
        setWalletClients(wc);
      }
      const auth = await signBillingAuth(wc.address, wc.walletClient);
      setDashBilling(await getBillingStatus(token, auth));
    } catch (err) {
      setDashBilling({ active: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setDashBillingChecking(false);
    }
  }

  async function handleSignGrant() {
    setSigningGrant(true);
    setError("");
    try {
      const { grantMessage, grantSignature } = await signGrantMessage(address);
      setGrantCredentials({ message: grantMessage, signature: grantSignature, walletAddress: address });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSigningGrant(false);
    }
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const billingReturn = params.get("billing") === "success";
    if (billingReturn) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    const saved = localStorage.getItem("clawt-session");
    if (!saved) {
      setView("landing");
      return;
    }

    const { token: t, address: a } = JSON.parse(saved);
    setToken(t);
    setAddress(a);

    let cancelled = false;
    Promise.all([getAgentInfo(t), fetchStaleAgents(t)])
      .then(([info]) => {
        if (cancelled) return;
        if (info && info.status !== "terminated") {
          setAgentInfo(info);
          setView("dashboard");
          return;
        }
        setSetupStep(1);
        setView("setup");
        getGrantStatus(a)
          .then((grant) => {
            if (!cancelled)
              setGrantStatus({ checked: true, hasGrant: grant.hasGrant, tokenCount: grant.tokenCount });
          })
          .catch(() => {
            if (!cancelled) setGrantStatus({ checked: true, hasGrant: false, tokenCount: 0 });
          });

        if (billingReturn) {
          (async () => {
            try {
              const result = await ensureWalletClient();
              if (cancelled) return;
              const wc = { walletClient: result.walletClient, publicClient: result.publicClient, address: result.address as `0x${string}` };
              setWalletClients(wc);
              const auth = await signBillingAuth(result.address as `0x${string}`, result.walletClient);
              const billing = await getBillingStatus(t, auth);
              if (!cancelled) {
                setBillingActive(billing.active);
                setBillingManageUrl(billing.portalUrl ?? null);
                setBillingError(billing.active ? null : (billing.error ?? null));
              }
            } catch {
              // Billing auto-check failed
            }
          })();
        }
      })
      .catch(() => {
        if (!cancelled) setView("landing");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.ethereum || !address) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0 || accounts[0].toLowerCase() !== address.toLowerCase()) {
        localStorage.removeItem("clawt-session");
        window.location.reload();
      }
    };

    const onChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener("chainChanged", onChainChanged);
    };
  }, [address]);

  async function handleConnect() {
    try {
      setError("");
      setLoading(true);
      const { address: addr, walletClient, publicClient } = await connectWallet();
      setWalletClients({ walletClient, publicClient, address: addr as `0x${string}` });
      const { message, signature } = await signSiweMessage(addr as `0x${string}`, walletClient);
      setSiweCredentials({ message, signature });
      const { token: t, hasAgent } = await verifyAuth(message, signature);
      localStorage.setItem("clawt-session", JSON.stringify({ token: t, address: addr }));
      setAddress(addr);
      setToken(t);
      if (hasAgent) {
        await checkAgent(t);
      } else {
        setSetupStep(1);
        setView("setup");
        runPreflightChecks(addr, walletClient, t);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeploy() {
    try {
      const { EIGEN_ENVIRONMENT } = await import("@/lib/network-config");
      if (EIGEN_ENVIRONMENT === "mainnet-alpha") {
        const ok = window.confirm(
          "You are deploying to Ethereum Mainnet.\n\nThis will cost real ETH for gas. Continue?"
        );
        if (!ok) return;
      }
      setError("");
      setLoading(true);
      setDeployPhase("tx-pending");
      const { deployAgent } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        const ec = await import("@/lib/eigencompute");
        clients = await ec.createClients();
        setWalletClients(clients);
      }
      let bypassSecret = "";
      try {
        const bRes = await fetch("/api/eigen/bypass-secret", { headers: { Authorization: `Bearer ${token}` } });
        if (bRes.ok) bypassSecret = (await bRes.json()).secret ?? "";
      } catch { /* non-fatal */ }

      const envVars: Record<string, string> = {
        BACKEND_URL: window.location.origin,
        AGENT_SOUL: selectedSoul.content,
        ...(bypassSecret && { VERCEL_BYPASS_SECRET: bypassSecret }),
      };
      if (grantCredentials) {
        envVars.EIGENAI_GRANT_MESSAGE = grantCredentials.message;
        envVars.EIGENAI_GRANT_SIGNATURE = grantCredentials.signature;
        envVars.EIGENAI_WALLET_ADDRESS = grantCredentials.walletAddress;
      }
      const ecloudName = `clawt-${address.slice(2, 10).toLowerCase()}`;
      const deployResult = await deployAgent(clients, envVars, { name: ecloudName, token });
      const { EIGEN_ENVIRONMENT: env } = await import("@/lib/network-config");
      await registerAgent(token, {
        name: agentName,
        appId: deployResult.appId,
        network: env === "mainnet-alpha" ? "mainnet" : "sepolia",
      });

      setDeployPhase("idle");
      await checkAgent(token);
    } catch (err) {
      setDeployPhase("failed");
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLifecycle(action: "start" | "stop" | "terminate") {
    try {
      setLoading(true);
      setError("");

      if (action === "terminate") {
        const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
        let clients = walletClients;
        if (!clients) {
          clients = await createClients();
          setWalletClients(clients);
        }
        if (agentInfo?.appId) {
          try {
            await sendLifecycleTx(clients, "terminate", agentInfo.appId as `0x${string}`);
          } catch {
            // On-chain app may already be terminated -- proceed with DB cleanup
          }
        }
        await updateAgentStatus(token, { status: "terminated" });
        setAgentInfo(null);
        setSetupStep(1);
        setView("setup");
        runPreflightChecks(address, clients?.walletClient, token);
        return;
      }

      const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      if (!agentInfo?.appId) throw new Error("No app ID");
      await sendLifecycleTx(clients, action, agentInfo.appId as `0x${string}`);
      const newStatus = action === "stop" ? "stopped" : "running";
      if (action === "start") {
        setAgentHealthy(null);
      }
      await updateAgentStatus(token, {
        status: newStatus,
        ...(action === "start" && { instanceIp: null }),
      });
      setAgentInfo((prev) =>
        prev
          ? { ...prev, status: newStatus, ...(action === "start" && { instanceIp: null }) }
          : null
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaleAgents(t: string) {
    try {
      const { allAgents, ghosts } = await getAllAgents(t);
      setStaleAgents(allAgents);
      setGhostAgents(ghosts);
    } catch {
      setStaleAgents([]);
      setGhostAgents([]);
    }
  }

  async function handleCleanupAgent(agent: StaleAgent) {
    setCleaningUpId(agent.id);
    setError("");
    try {
      if (agent.appId) {
        const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
        let clients = walletClients;
        if (!clients) {
          clients = await createClients();
          setWalletClients(clients);
        }
        await sendLifecycleTx(clients, "terminate", agent.appId as `0x${string}`);
      }
      await terminateAgentById(token, agent.id);
      setStaleAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (confirm(`On-chain terminate failed: ${msg}\n\nForce-terminate in DB only? (Container may still run on EigenCompute)`)) {
        try {
          await terminateAgentById(token, agent.id);
          setStaleAgents((prev) => prev.filter((a) => a.id !== agent.id));
        } catch (dbErr) {
          setError((dbErr as Error).message);
        }
      }
    } finally {
      setCleaningUpId(null);
    }
  }

  const STATUS_LABELS: Record<number, string> = { 0: "starting", 1: "running", 2: "stopped", 3: "terminated" };

  async function fetchEigenAccount() {
    setEigenAccountLoading(true);
    try {
      const sdk = await import("@layr-labs/ecloud-sdk/browser");
      const { createClients } = await import("@/lib/eigencompute");
      const { EIGEN_ENVIRONMENT } = await import("@/lib/network-config");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      const envConfig = sdk.getEnvironmentConfig(EIGEN_ENVIRONMENT);
      const [activeCount, maxApps, allApps, namesRes] = await Promise.all([
        sdk.getActiveAppCount(clients.publicClient, envConfig, clients.address),
        sdk.getMaxActiveAppsPerUser(clients.publicClient, envConfig, clients.address),
        sdk.getAllAppsByDeveloper(clients.publicClient, envConfig, clients.address),
        token
          ? fetch("/api/agents/app-names", { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => (r.ok ? r.json() : { nameMap: {} }))
              .catch(() => ({ nameMap: {} }))
          : Promise.resolve({ nameMap: {} }),
      ]);
      setAppNameMap(namesRes.nameMap ?? {});
      setEigenAccount({
        activeCount,
        maxApps,
        apps: allApps.apps.map((a, i) => ({
          appId: a,
          status: allApps.appConfigs[i].status,
        })),
      });
    } catch (err) {
      setError(`EigenCompute query failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setEigenAccountLoading(false);
    }
  }

  async function fetchDeployDiag() {
    if (!agentInfo?.appId || !token) return;
    setDeployDiagLoading(true);
    setDeployDiag(null);
    try {
      const res = await fetch(
        `/api/debug/eigen-status?appId=${encodeURIComponent(agentInfo.appId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDeployDiag({
        status: data.teeStatus,
        ip: data.teeIp && data.teeIp !== "REDACTED" ? data.teeIp : undefined,
        derivedWallet: data.derivedWallet,
        machineType: data.machineType,
        contractStatus: data.contractStatus,
        error: data.infoError,
      });
    } catch (err) {
      setDeployDiag({ error: `Failed: ${err instanceof Error ? err.message : err}` });
    } finally {
      setDeployDiagLoading(false);
    }
  }

  async function handleTerminateOnChain(appId: string) {
    setTerminatingAppId(appId);
    setError("");
    try {
      const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      await sendLifecycleTx(clients, "terminate", appId as `0x${string}`);
      setEigenAccount((prev) =>
        prev
          ? {
              ...prev,
              activeCount: Math.max(0, prev.activeCount - 1),
              apps: prev.apps.map((a) =>
                a.appId === appId ? { ...a, status: 3 } : a
              ),
            }
          : prev
      );
    } catch (err) {
      setError(`Terminate failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setTerminatingAppId(null);
    }
  }

  async function handleTerminateGhost(agent: StaleAgent) {
    if (!agent.appId) return;
    setCleaningUpId(agent.id);
    setError("");
    try {
      const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      await sendLifecycleTx(clients, "terminate", agent.appId as `0x${string}`);
      try { await dismissGhosts(token, [agent.id]); } catch { /* best-effort DB cleanup */ }
      setGhostAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already terminated") || msg.includes("revert")) {
        try { await dismissGhosts(token, [agent.id]); } catch { /* best-effort */ }
        setGhostAgents((prev) => prev.filter((a) => a.id !== agent.id));
      } else {
        setError(`Ghost terminate failed: ${msg}`);
      }
    } finally {
      setCleaningUpId(null);
    }
  }

  async function handleTask() {
    try {
      setError("");
      setLoading(true);
      const res = await submitTask(token, task);
      setResult(res.result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEnvVars() {
    if (!token || agentStatus !== "running") return;
    setEnvLoading(true);
    setEnvError("");
    try {
      const vars = await getAgentEnv(token);
      setEnvVars(vars);
      setEnvDraft(vars);
      setEnvRevealed(new Set());
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnvLoading(false);
    }
  }

  async function handleEnvSave() {
    if (!agentInfo?.appId) return;
    setEnvSaving(true);
    setEnvError("");
    try {
      const { upgradeAgentEnv, createClients } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      await upgradeAgentEnv(clients, agentInfo.appId as `0x${string}`, envDraft, { token });
      setEnvVars({ ...envDraft });
      setEnvRevealed(new Set());
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnvSaving(false);
    }
  }

  function handleEnvAdd() {
    const key = envNewKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!key || key in envDraft) return;
    setEnvDraft((prev) => ({ ...prev, [key]: envNewValue }));
    setEnvNewKey("");
    setEnvNewValue("");
  }

  function handleEnvDelete(key: string) {
    setEnvDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function maskValue(value: string): string {
    if (value.length <= 6) return "\u2022".repeat(value.length);
    return value.slice(0, 3) + "\u2022".repeat(Math.min(value.length - 6, 12)) + value.slice(-3);
  }

  function fetchPurchasedSouls() {
    if (!token) return;
    fetch("/api/marketplace/purchases?type=soul", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { purchases: [] }))
      .then((data) => {
        const souls: Soul[] = (data.purchases ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => ({
            id: `purchased-${p.listing.id}`,
            name: p.listing.title,
            tagline: p.listing.description,
            icon: "sparkle",
            content: p.listing.content,
          })
        );
        setPurchasedSouls(souls);
      })
      .catch(() => {});
  }

  async function handleDisconnect() {
    await disconnectWallet();
    localStorage.removeItem("clawt-session");
    setAddress("");
    setToken("");
    setAgentInfo(null);
    setSiweCredentials(null);
    setWalletClients(null);
    setHealth(null);
    setEvolution(null);
    setAgentHealthy(null);
    setView("landing");
  }

  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const agentStatus = agentInfo?.status ?? "";
  const TABS: { id: DashboardTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "evolution", label: "Self-Improvement" },
    { id: "tools", label: "Skills" },
    { id: "identity", label: "Identity" },
    { id: "settings", label: "Settings" },
  ];

  const playbookParsed = evolution?.playbook ? parsePlaybookForUI(evolution.playbook) : null;
  const pbStats = evolution?.stats.playbook;
  const prStats = evolution?.stats.principles;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">CLAWT</h1>
              <NetworkToggle compact />
            </div>
            <nav className="flex gap-4 text-sm">
              <Link href="/skills" className="text-muted-foreground transition-colors hover:text-foreground">Skills</Link>
              <Link href="/souls" className="text-muted-foreground transition-colors hover:text-foreground">Souls</Link>
            </nav>
          </div>
          {address && (
            <div className="flex items-center gap-4">
              <span className="rounded-lg bg-muted px-3 py-1.5 font-mono text-xs">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button
                onClick={handleDisconnect}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Landing ── */}
        {view === "landing" && (
          <div className="mx-auto max-w-md pt-20 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={SOUL_ICONS.sparkle} />
              </svg>
            </div>
            <h2 className="mb-3 text-2xl font-semibold">Deploy Your Own AI Agent</h2>
            <p className="mb-6 text-muted-foreground">
              Sign in with your Ethereum wallet to deploy a verifiable, self-improving AI agent in a Trusted Execution Environment on EigenCompute.
            </p>
            <div className="mb-6">
              <NetworkToggle />
            </div>
            {hasMetaMask() ? (
              <button onClick={handleConnect} disabled={loading} className="rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <p className="text-muted-foreground">
                Please install{" "}
                <a href="https://metamask.io" className="text-primary underline" target="_blank" rel="noreferrer">MetaMask</a>{" "}
                to continue.
              </p>
            )}
          </div>
        )}

        {/* ── Setup Step 1: Preflight ── */}
        {view === "setup" && setupStep === 1 && (
          <div className="mx-auto max-w-lg pt-10">
            <h2 className="mb-1 text-xl font-semibold">Pre-Deploy Checks</h2>
            <p className="mb-6 text-sm text-muted-foreground">Verify EigenCloud billing before deploying. EigenAI grant is optional.</p>

            {staleAgents.length > 0 && (
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
                <h3 className="mb-1 text-sm font-semibold text-amber-800">Active Agents Found</h3>
                <p className="mb-3 text-xs text-amber-700">
                  Terminate these before deploying a new agent. Each terminate requires a MetaMask signature to stop the container on EigenCompute.
                </p>
                <div className="space-y-2">
                  {staleAgents.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-xs font-medium">#{a.id} {a.name}</span>
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{a.status}</span>
                        {a.appId && (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{a.appId}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCleanupAgent(a)}
                        disabled={cleaningUpId !== null}
                        className="ml-3 shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {cleaningUpId === a.id ? "Terminating..." : "Terminate"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="rounded-lg border border-border p-5">
                <div className="mb-2 flex items-center gap-2">
                  {billingActive ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
                  ) : billingError ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">&#10005;</span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs">?</span>
                  )}
                  <h3 className="text-sm font-medium">EigenCloud Billing</h3>
                </div>
                {billingActive ? (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p>Subscription active</p>
                    {billingManageUrl && <a href={billingManageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary underline">Manage billing</a>}
                  </div>
                ) : billingError ? (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">No active subscription found. Set up billing to deploy your agent.</p>
                    <button onClick={handleSubscribeBilling} disabled={subscribingBilling} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                      {subscribingBilling ? "Redirecting..." : "Set Up Billing"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">Check your EigenCloud billing status.</p>
                    <button onClick={handleCheckBilling} disabled={checkingPreflight} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                      {checkingPreflight ? "Checking..." : "Check Billing"}
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border p-5">
                <div className="mb-2 flex items-center gap-2">
                  {grantCredentials ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
                  ) : grantStatus.hasGrant ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-xs">!</span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">&#10005;</span>
                  )}
                  <h3 className="text-sm font-medium">EigenAI Grant <span className="text-xs font-normal text-muted-foreground">(optional)</span></h3>
                </div>
                {grantCredentials ? (
                  <div className="ml-7 text-sm text-muted-foreground">Grant authorized{grantStatus.tokenCount > 0 ? ` (${grantStatus.tokenCount.toLocaleString()} tokens)` : ""}</div>
                ) : grantStatus.hasGrant ? (
                  <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                    <p>Sign to authorize your agent to use your EigenAI grant.</p>
                    <button onClick={handleSignGrant} disabled={signingGrant} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                      {signingGrant ? "Signing..." : "Sign Authorization"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p>No grant found. You can deploy without one &mdash; task processing will be unavailable until a grant is added. <a href="https://determinal.eigenarcade.com/" target="_blank" rel="noreferrer" className="text-primary underline">Get one at EigenArcade</a>.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => runPreflightChecks(address, walletClients?.walletClient, token)} disabled={checkingPreflight} className="rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50">
                {checkingPreflight ? "Checking..." : "Check Again"}
              </button>
              <button onClick={() => { setSetupStep(2); fetchPurchasedSouls(); }} disabled={!billingActive} className="flex-1 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                Continue{!grantCredentials && billingActive ? " (without grant)" : ""}
              </button>
            </div>
          </div>
        )}

        {/* ── Setup Step 2: Choose Soul ── */}
        {view === "setup" && setupStep === 2 && (
          <div className="mx-auto max-w-2xl pt-10">
            <button onClick={() => setSetupStep(1)} className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground">&larr; Back</button>
            <h2 className="mb-1 text-xl font-semibold">Choose a Soul</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Select a personality for your agent. This shapes how it communicates, makes decisions, and evolves.{" "}
              <Link href="/souls" className="text-primary underline">Browse more souls</Link>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {purchasedSouls.map((soul) => (
                <button
                  key={soul.id}
                  onClick={() => setSelectedSoul(soul)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    selectedSoul.id === soul.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">purchased</span>
                    <span className="text-sm font-medium">{soul.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{soul.tagline}</p>
                </button>
              ))}
              {STARTER_SOULS.map((soul) => (
                <button
                  key={soul.id}
                  onClick={() => setSelectedSoul(soul)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    selectedSoul.id === soul.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={SOUL_ICONS[soul.icon] ?? SOUL_ICONS.sparkle} />
                    </svg>
                    <span className="text-sm font-medium">{soul.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{soul.tagline}</p>
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setSetupStep(3)} className="flex-1 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Continue with {selectedSoul.name}
              </button>
            </div>
          </div>
        )}

        {/* ── Setup Step 3: Name & Deploy ── */}
        {view === "setup" && setupStep === 3 && (
          <div className="mx-auto max-w-md pt-10">
            <button onClick={() => setSetupStep(2)} disabled={loading} className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">&larr; Back</button>
            <h2 className="mb-1 text-xl font-semibold">Deploy Agent</h2>
            <p className="mb-2 text-sm text-muted-foreground">
              Soul: <span className="font-medium text-foreground">{selectedSoul.name}</span>
            </p>
            <p className="mb-6 text-sm text-muted-foreground">Name your agent and deploy it to EigenCompute.</p>
            <input
              type="text"
              placeholder="Agent name (e.g. my-defi-agent)"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              disabled={loading}
              className="mb-4 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-50"
            />

            <button onClick={handleDeploy} disabled={!agentName || loading} className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              {deployPhase === "tx-pending" ? "Confirming on-chain (check MetaMask)..." :
                loading ? "Deploying..." : "Deploy"}
            </button>
          </div>
        )}

        {/* ── Dashboard ── */}
        {view === "dashboard" && (
          <div className="space-y-6">
            {/* Starting up banner */}
            {agentInfo && !agentInfo.instanceIp && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span className="font-medium">Agent is starting up</span>
                </div>
                <p className="mt-1 text-xs text-blue-600">
                  TEE provisioning can take a few minutes. This banner will disappear when the agent comes online.
                </p>
              </div>
            )}

            {/* Stale agents banner */}
            {staleAgents.filter((a) => a.appId !== agentInfo?.appId).length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h3 className="mb-1 text-sm font-semibold text-amber-800">Stale Agents Still Active</h3>
                <p className="mb-3 text-xs text-amber-700">
                  These old agents are still running on EigenCompute. Terminate them to free quota and prevent heartbeat conflicts.
                </p>
                <div className="space-y-2">
                  {staleAgents
                    .filter((a) => a.appId !== agentInfo?.appId)
                    .map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <span className="text-xs font-medium">#{a.id} {a.name}</span>
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{a.status}</span>
                          {a.appId && (
                            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{a.appId}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleCleanupAgent(a)}
                          disabled={cleaningUpId !== null}
                          className="ml-3 shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {cleaningUpId === a.id ? "Terminating..." : "Terminate"}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {/* Ghost containers banner */}
            {ghostAgents.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-red-800">Ghost Containers ({ghostAgents.length})</h3>
                  <button
                    onClick={async () => {
                      const ids = ghostAgents.map((g) => g.id);
                      try { await dismissGhosts(token, ids); } catch { /* best-effort */ }
                      setGhostAgents([]);
                    }}
                    className="text-xs text-red-600 underline transition-opacity hover:opacity-70"
                  >
                    Dismiss all
                  </button>
                </div>
                <p className="mb-3 text-xs text-red-700">
                  Old agents terminated in the DB. Use &quot;On-chain Kill&quot; only if MetaMask does NOT show &quot;likely to fail&quot; -- that warning means the container is already dead. Dismiss dead ones.
                </p>
                <div className="space-y-2">
                  {ghostAgents.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-red-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-xs font-medium">#{a.id} {a.name}</span>
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ghost</span>
                        {a.appId && (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{a.appId}</p>
                        )}
                      </div>
                      <div className="ml-3 flex shrink-0 gap-2">
                        <button
                          onClick={async () => {
                            try { await dismissGhosts(token, [a.id]); } catch { /* best-effort */ }
                            setGhostAgents((prev) => prev.filter((g) => g.id !== a.id));
                          }}
                          className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleTerminateGhost(a)}
                          disabled={cleaningUpId !== null}
                          className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {cleaningUpId === a.id ? "Signing..." : "On-chain Kill"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{agentInfo?.name ?? "Your Agent"}</h2>
                {agentInfo?.walletAddressEth ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{agentInfo.walletAddressEth}</p>
                ) : agentStatus === "deploying" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Wallet: awaiting TEE attestation...</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {(() => {
                  let statusLabel: string;
                  let statusClass: string;
                  if (agentStatus === "running" && !agentInfo?.instanceIp) {
                    statusLabel = "Connecting...";
                    statusClass = "bg-blue-100 text-blue-700";
                  } else if (agentStatus === "running" && agentHealthy === false) {
                    statusLabel = "Unreachable";
                    statusClass = "bg-red-100 text-red-700";
                  } else if (agentStatus === "running" && agentHealthy === true) {
                    statusLabel = "Online";
                    statusClass = "bg-green-100 text-green-700";
                  } else if (agentStatus === "running") {
                    statusLabel = "Running";
                    statusClass = "bg-green-100 text-green-700";
                  } else if (agentStatus === "stopped") {
                    statusLabel = "Offline";
                    statusClass = "bg-yellow-100 text-yellow-700";
                  } else if (agentStatus === "deploying") {
                    statusLabel = "Starting...";
                    statusClass = "bg-blue-100 text-blue-700";
                  } else {
                    statusLabel = agentStatus;
                    statusClass = "bg-gray-100 text-gray-600";
                  }
                  return (
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                  );
                })()}
                <div className="flex gap-1">
                  {agentStatus === "running" ? (
                    <button onClick={() => handleLifecycle("stop")} disabled={loading} className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50">Stop</button>
                  ) : (
                    <button onClick={() => handleLifecycle("start")} disabled={loading} className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50">Start</button>
                  )}
                  <button onClick={() => handleLifecycle("terminate")} disabled={loading} className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">Terminate</button>
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setDashTab(tab.id);
                    if (tab.id === "tools") getAgentSkills(token).then(setSkills);
                    if (tab.id === "settings") fetchEnvVars();
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    dashTab === tab.id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Overview Tab ── */}
            {dashTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Uptime" value={health?.uptime.formatted ?? "--"} />
                  <StatCard
                    label="Playbook Bullets"
                    value={pbStats?.totalBullets ?? 0}
                    sub={pbStats ? `${pbStats.highPerforming} strong` : undefined}
                  />
                  <StatCard
                    label="Principles Learned"
                    value={prStats?.total ?? 0}
                    sub={prStats ? `avg ${prStats.avgScore.toFixed(2)}` : undefined}
                  />
                  <StatCard
                    label="Memory"
                    value={health?.memory.count ?? 0}
                    sub={`${health?.scheduler.tasks ?? 0} scheduled`}
                  />
                </div>

                {pbStats && (
                  <TokenBudgetBar used={pbStats.approxTokens} budget={4000} />
                )}

                {health && (
                  <div className="rounded-lg border border-border p-4">
                    <h3 className="mb-3 text-sm font-medium">Memory</h3>
                    <div className="flex gap-4 text-xs">
                      {Object.entries(health.memory.categories).map(([cat, count]) => (
                        <div key={cat} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary/60" />
                          <span className="text-muted-foreground">{cat}: <span className="font-medium text-foreground">{count}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border p-5">
                  <h3 className="mb-3 text-sm font-medium">Submit Task</h3>
                  <textarea
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="What do you want your agent to do?"
                    className="mb-3 h-28 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                  <button onClick={handleTask} disabled={!task || agentStatus !== "running" || loading} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                </div>

                {result && (
                  <div className="rounded-lg border border-border bg-muted/50 p-5">
                    <h3 className="mb-2 text-sm font-medium">Result</h3>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">{result}</pre>
                  </div>
                )}
              </div>
            )}

            {/* ── Self-Improvement Tab ── */}
            {dashTab === "evolution" && (
              <div className="space-y-8">
                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <StatCard label="Playbook Bullets" value={pbStats?.totalBullets ?? 0} />
                  <StatCard label="High Performing" value={pbStats?.highPerforming ?? 0} />
                  <StatCard label="Problematic" value={pbStats?.problematic ?? 0} />
                  <StatCard label="Principles" value={prStats?.total ?? 0} />
                  <StatCard label="Avg Score" value={prStats?.avgScore.toFixed(2) ?? "0.00"} />
                </div>

                {pbStats && (
                  <TokenBudgetBar used={pbStats.approxTokens} budget={4000} />
                )}

                {/* Playbook */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Adaptive Playbook</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Evolving guidance that shapes your agent&apos;s decisions. Updated automatically via reflection and periodic curation.
                      </p>
                    </div>
                  </div>

                  {playbookParsed && playbookParsed.sections.size > 0 ? (
                    <div className="space-y-6">
                      {Array.from(playbookParsed.sections.entries()).map(([section, bullets]) => (
                        <PlaybookSection key={section} title={section} bullets={bullets} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No playbook entries yet. Your agent will build its playbook as it handles tasks and reflects on outcomes.
                    </div>
                  )}
                </div>

                {/* Principles */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">Learned Principles</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Strategic knowledge distilled from past tasks. Each principle has a Bayesian score tracking its effectiveness.
                    </p>
                  </div>

                  {evolution && evolution.principles.length > 0 ? (
                    <div className="space-y-2">
                      {evolution.principles.map((p: PrincipleEntry) => (
                        <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            p.type === "guiding"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {p.type}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-relaxed">{p.description}</p>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>Used {p.usageCount}x</span>
                              <span>{p.successCount}/{p.usageCount} succeeded</span>
                              <span>{timeAgo(p.createdAt)}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <ScoreBar score={p.metricScore} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No principles learned yet. After completing tasks, your agent distills reusable strategic principles from each interaction.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Skills Tab ── */}
            {dashTab === "tools" && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Available Skills</h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Skills your agent can select from to handle tasks. Browse the{" "}
                    <Link href="/skills" className="text-primary underline">skill catalog</Link>{" "}
                    or discover premium skills on the{" "}
                    <Link href="/skills" className="text-primary underline">marketplace</Link>.
                  </p>
                  {skills.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {skills.map((s) => (
                        <div key={s.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {s.author === "marketplace" && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">marketplace</span>
                              )}
                              <span className="text-sm font-medium">{s.id}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">v{s.version}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                      No skills loaded. Start your agent to discover available skills.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Identity Tab ── */}
            {dashTab === "identity" && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-sm font-medium">SOUL.md</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Core identity and values. Immutable after deployment &mdash; protected by integrity verification.</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{selectedSoul?.content ?? "Not set"}</pre>
                  </div>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">USER.md</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Learned preferences. Updated as the agent reflects on tasks.</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                      Your agent will update this as it learns about you.
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* ── Settings Tab ── */}
            {dashTab === "settings" && (
              <div className="space-y-6">
                {/* ── EigenCompute Account ── */}
                <div className="rounded-lg border border-border p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">EigenCompute Account</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Your on-chain apps and quota.</p>
                    </div>
                    <button
                      onClick={fetchEigenAccount}
                      disabled={eigenAccountLoading}
                      className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {eigenAccountLoading ? "Loading\u2026" : eigenAccount ? "Refresh" : "Load"}
                    </button>
                  </div>
                  {eigenAccount ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">Active apps:</span>
                          <span className="font-medium">{eigenAccount.activeCount} / {eigenAccount.maxApps}</span>
                        </div>
                        {eigenAccount.apps.filter((a) => (a.status === 1 || a.status === 2) && a.appId !== agentInfo?.appId).length > 1 && (
                          <button
                            onClick={async () => {
                              const zombies = eigenAccount.apps.filter(
                                (a) => (a.status === 1 || a.status === 2) && a.appId !== agentInfo?.appId
                              );
                              for (const z of zombies) {
                                await handleTerminateOnChain(z.appId);
                              }
                            }}
                            disabled={!!terminatingAppId}
                            className="rounded bg-red-600 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          >
                            {terminatingAppId ? "Terminating\u2026" : `Terminate ${eigenAccount.apps.filter((a) => (a.status === 1 || a.status === 2) && a.appId !== agentInfo?.appId).length} zombies`}
                          </button>
                        )}
                      </div>
                      {eigenAccount.apps.length > 0 && (() => {
                        const activeApps = eigenAccount.apps.filter((a) => a.status !== 3);
                        const terminatedApps = eigenAccount.apps.filter((a) => a.status === 3);
                        const renderRow = (a: { appId: string; status: number }) => {
                          const isCurrentAgent = agentInfo?.appId === a.appId;
                          const canTerminate = (a.status === 1 || a.status === 2) && !isCurrentAgent;
                          const name = appNameMap[a.appId.toLowerCase()];
                          return (
                            <tr key={a.appId} className="border-b border-border/50">
                              <td className="py-1.5">
                                {name && (
                                  <span className="block text-xs font-medium">{name}</span>
                                )}
                                <span className={`block font-mono ${name ? "text-[10px] text-muted-foreground" : ""}`}>
                                  {a.appId.slice(0, 10)}&hellip;{a.appId.slice(-6)}
                                </span>
                                {isCurrentAgent && (
                                  <span className="ml-1.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">current</span>
                                )}
                              </td>
                              <td className="py-1.5">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  a.status === 1
                                    ? "bg-green-100 text-green-700"
                                    : a.status === 3
                                      ? "bg-red-100 text-red-700"
                                      : "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {STATUS_LABELS[a.status] ?? `unknown(${a.status})`}
                                </span>
                              </td>
                              <td className="py-1.5">
                                {canTerminate ? (
                                  <button
                                    onClick={() => handleTerminateOnChain(a.appId)}
                                    disabled={terminatingAppId === a.appId}
                                    className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {terminatingAppId === a.appId ? "Terminating\u2026" : "Terminate"}
                                  </button>
                                ) : a.status === 3 ? (
                                  <span className="text-[10px] text-muted-foreground">terminated</span>
                                ) : null}
                              </td>
                            </tr>
                          );
                        };
                        return (
                          <>
                            {activeApps.length > 0 && (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-1 font-medium">App</th>
                                    <th className="pb-1 font-medium">Status</th>
                                    <th className="pb-1 font-medium">Action</th>
                                  </tr>
                                </thead>
                                <tbody>{activeApps.map(renderRow)}</tbody>
                              </table>
                            )}
                            {terminatedApps.length > 0 && (
                              <div>
                                <button
                                  onClick={() => setShowTerminated((p) => !p)}
                                  className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  <span className="inline-block transition-transform" style={{ transform: showTerminated ? "rotate(90deg)" : "rotate(0deg)" }}>&rsaquo;</span>
                                  {terminatedApps.length} terminated app{terminatedApps.length !== 1 ? "s" : ""}
                                </button>
                                {showTerminated && (
                                  <table className="mt-1 w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-1 font-medium">App</th>
                                        <th className="pb-1 font-medium">Status</th>
                                        <th className="pb-1 font-medium">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>{terminatedApps.map(renderRow)}</tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : !eigenAccountLoading ? (
                    <p className="text-xs text-muted-foreground">Click <strong>Load</strong> to query your on-chain apps.</p>
                  ) : null}
                </div>

                {/* ── Deployment Diagnostics ── */}
                {agentInfo?.appId && (
                  <div className="rounded-lg border border-border p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">Deployment Diagnostics</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Query EigenCompute for container status and logs.</p>
                      </div>
                      <button
                        onClick={fetchDeployDiag}
                        disabled={deployDiagLoading}
                        className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        {deployDiagLoading ? "Checking\u2026" : deployDiag ? "Re-check" : "Check"}
                      </button>
                    </div>
                    {deployDiag && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                          <div>
                            <span className="text-muted-foreground">TEE status: </span>
                            <span className={`font-medium ${deployDiag.status === "Running" ? "text-green-600" : deployDiag.status === "Terminated" ? "text-red-600" : deployDiag.status ? "text-yellow-600" : "text-muted-foreground"}`}>
                              {deployDiag.status ?? "unknown"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">TEE IP: </span>
                            <span className="font-mono font-medium">{deployDiag.ip ?? "redacted"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Machine: </span>
                            <span className="font-medium">{deployDiag.machineType ?? "unknown"}</span>
                          </div>
                          {deployDiag.derivedWallet && (
                            <div className="col-span-2 sm:col-span-3">
                              <span className="text-muted-foreground">TEE wallet: </span>
                              <span className="font-mono font-medium">{deployDiag.derivedWallet}</span>
                            </div>
                          )}
                        </div>
                        {deployDiag.status === "Running" && !agentInfo?.walletAddressEth && (
                          <div className="rounded bg-yellow-50 p-2 text-xs text-yellow-800">
                            Container is running on EigenCompute but has not sent a heartbeat.
                            Likely cause: BACKEND_URL env var not decrypted, DNS resolution failure, or outbound HTTP blocked inside TEE.
                          </div>
                        )}
                        {deployDiag.error && (
                          <div className="rounded bg-red-50 p-2 text-xs text-red-700">{deployDiag.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-border p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">EigenCloud Billing</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Subscription, credits, and upcoming invoice.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dashBilling?.portalUrl && (
                        <a
                          href={dashBilling.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted"
                        >
                          Manage Billing
                        </a>
                      )}
                      <button
                        onClick={handleDashBillingCheck}
                        disabled={dashBillingChecking}
                        className="rounded border border-border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        {dashBillingChecking ? "Loading\u2026" : dashBilling ? "Refresh" : "Load"}
                      </button>
                    </div>
                  </div>

                  {dashBilling ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {dashBilling.active ? (
                          <>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
                            <span className="text-sm font-medium">
                              {dashBilling.subscriptionStatus === "active" ? "Active" : (dashBilling.subscriptionStatus ?? "Active")}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">&#10005;</span>
                            <span className="text-sm text-muted-foreground">{dashBilling.error ?? `Status: ${dashBilling.subscriptionStatus ?? "inactive"}`}</span>
                          </>
                        )}
                        {dashBilling.cancelAtPeriodEnd && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">Cancels at period end</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                        {dashBilling.currentPeriodEnd && (
                          <div>
                            <span className="text-muted-foreground">Period ends</span>
                            <p className="font-medium">{new Date(dashBilling.currentPeriodEnd).toLocaleDateString()}</p>
                          </div>
                        )}
                        {dashBilling.upcomingInvoiceTotal != null && (
                          <div>
                            <span className="text-muted-foreground">Upcoming invoice</span>
                            <p className="font-medium">${(dashBilling.upcomingInvoiceTotal / 100).toFixed(2)}</p>
                          </div>
                        )}
                        {dashBilling.remainingCredits != null && (
                          <div>
                            <span className="text-muted-foreground">Credits remaining</span>
                            <p className="font-medium">${(dashBilling.remainingCredits / 100).toFixed(2)}</p>
                          </div>
                        )}
                        {dashBilling.creditsApplied != null && dashBilling.creditsApplied > 0 && (
                          <div>
                            <span className="text-muted-foreground">Credits applied</span>
                            <p className="font-medium">${(dashBilling.creditsApplied / 100).toFixed(2)}</p>
                          </div>
                        )}
                        {dashBilling.nextCreditExpiry != null && (
                          <div>
                            <span className="text-muted-foreground">Credit expiry</span>
                            <p className="font-medium">{new Date(dashBilling.nextCreditExpiry * 1000).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>

                      {dashBilling.lineItems && dashBilling.lineItems.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-1 font-medium">Item</th>
                              <th className="pb-1 text-right font-medium">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashBilling.lineItems.map((li, idx) => (
                              <tr key={idx} className="border-b border-border/50">
                                <td className="py-1.5">{li.description}</td>
                                <td className="py-1.5 text-right">${(li.subtotal / 100).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : !dashBillingChecking ? (
                    <p className="text-xs text-muted-foreground">Click <strong>Load</strong> to check your billing status.</p>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Checking subscription&hellip;
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium">Environment Variables</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Manage the environment variables running inside your TEE agent. Saving triggers an on-chain upgrade and restarts your agent.
                  </p>
                </div>

                {envError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {envError}
                    <button onClick={() => setEnvError("")} className="ml-2 font-medium underline">Dismiss</button>
                  </div>
                )}

                {envSaving && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Upgrading&hellip; your agent will restart with the new configuration. Please confirm in MetaMask.
                  </div>
                )}

                {agentStatus !== "running" ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Start your agent to manage environment variables.
                  </div>
                ) : envLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="px-4 py-2.5 text-left text-xs font-medium">Key</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium">Value</th>
                            <th className="w-24 px-4 py-2.5 text-right text-xs font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(envDraft).sort().map((key) => {
                            const isSystem = SYSTEM_ENV_KEYS.has(key);
                            const revealed = envRevealed.has(key);
                            const changed = envVars[key] !== envDraft[key] || !(key in envVars);
                            return (
                              <tr key={key} className="border-b border-border last:border-0">
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-medium">{key}</span>
                                    {isSystem && (
                                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">system</span>
                                    )}
                                    {changed && (
                                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-700">modified</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  {isSystem ? (
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {revealed ? envDraft[key] : maskValue(envDraft[key])}
                                    </span>
                                  ) : (
                                    <input
                                      type={revealed ? "text" : "password"}
                                      value={envDraft[key]}
                                      onChange={(e) =>
                                        setEnvDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                      }
                                      className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs outline-none transition-colors focus:border-primary"
                                    />
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() =>
                                        setEnvRevealed((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(key)) next.delete(key);
                                          else next.add(key);
                                          return next;
                                        })
                                      }
                                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                      title={revealed ? "Hide" : "Reveal"}
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        {revealed ? (
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        ) : (
                                          <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </>
                                        )}
                                      </svg>
                                    </button>
                                    {!isSystem && (
                                      <button
                                        onClick={() => handleEnvDelete(key)}
                                        className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                        title="Delete"
                                      >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {Object.keys(envDraft).length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                No environment variables found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-lg border border-border p-4">
                      <h4 className="mb-3 text-xs font-medium">Add Variable</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="KEY_NAME"
                          value={envNewKey}
                          onChange={(e) => setEnvNewKey(e.target.value)}
                          className="w-48 rounded border border-border bg-background px-3 py-2 font-mono text-xs uppercase outline-none transition-colors focus:border-primary"
                        />
                        <input
                          type="text"
                          placeholder="value"
                          value={envNewValue}
                          onChange={(e) => setEnvNewValue(e.target.value)}
                          className="flex-1 rounded border border-border bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary"
                        />
                        <button
                          onClick={handleEnvAdd}
                          disabled={!envNewKey.trim()}
                          className="rounded bg-muted px-4 py-2 text-xs font-medium transition-colors hover:bg-muted/80 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={fetchEnvVars}
                        disabled={envLoading}
                        className="rounded border border-border px-4 py-2 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        Refresh
                      </button>
                      <button
                        onClick={handleEnvSave}
                        disabled={!envDirty || envSaving}
                        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {envSaving ? "Saving (confirm in MetaMask)..." : "Save Changes"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
