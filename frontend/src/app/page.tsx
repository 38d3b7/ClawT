"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  hasMetaMask,
  connectWallet,
  disconnectWallet,
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
  getAgentHealth,
  getAgentEvolution,
  getAgentSkills,
  getAgentEnv,
} from "@/lib/api";
import type {
  AgentInfo,
  HealthData,
  EvolutionData,
  EvolutionLogEntry,
  SkillInfo,
} from "@/lib/api";
import { STARTER_SOULS } from "@/lib/souls";
import type { Soul } from "@/lib/souls";
import Link from "next/link";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

type View = "landing" | "setup" | "dashboard" | "loading";
type DashboardTab = "overview" | "evolution" | "tools" | "identity" | "audit" | "settings";

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

function RiskBadge({ score }: { score: number }) {
  const cls =
    score <= 2
      ? "bg-green-100 text-green-700"
      : score === 3
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{score}</span>;
}

function ActionIcon({ action }: { action: string }) {
  const labels: Record<string, string> = {
    synthesize_tool: "T",
    create_skill: "S",
    install_package: "P",
    write_file: "W",
  };
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
      {labels[action] ?? "?"}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
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
  const [resigning, setResigning] = useState(false);
  const [siweCredentials, setSiweCredentials] = useState<SiweCredentials | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [walletClients, setWalletClients] = useState<any>(null);
  const initRef = useRef(false);

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

  const SYSTEM_ENV_KEYS = new Set(["MNEMONIC", "BACKEND_URL", "PORT"]);

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

    fetchDashboardData(token);
    getAgentSkills(token).then(setSkills);

    pollRef.current = setInterval(() => fetchDashboardData(token), 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [view, token, fetchDashboardData]);

  const checkAgent = useCallback(
    async (t: string) => {
      try {
        const info = await getAgentInfo(t);
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
          checkBillingViaProxy(addr as `0x${string}`, wc, t),
          getGrantStatus(addr),
        ]);
        setBillingActive(billing.active);
        setBillingManageUrl(billing.portalUrl ?? null);
        setBillingError(billing.active ? null : (billing.error ?? null));
        setGrantStatus({ checked: true, hasGrant: grant.hasGrant, tokenCount: grant.tokenCount });
      } catch {
        setBillingActive(false);
        setGrantStatus({ checked: true, hasGrant: false, tokenCount: 0 });
      } finally {
        setCheckingPreflight(false);
      }
    },
    []
  );

  async function handleResign() {
    setResigning(true);
    setError("");
    try {
      const { address: addr, walletClient, publicClient } = await connectWallet();
      setWalletClients({ walletClient, publicClient, address: addr as `0x${string}` });
      const { message, signature } = await signSiweMessage(addr as `0x${string}`, walletClient);
      setSiweCredentials({ message, signature });
      const { token: t } = await verifyAuth(message, signature);
      localStorage.setItem("clawt-session", JSON.stringify({ token: t, address: addr }));
      setAddress(addr);
      setToken(t);
      await runPreflightChecks(addr, walletClient, t);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResigning(false);
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

    const saved = localStorage.getItem("clawt-session");
    if (!saved) {
      setView("landing");
      return;
    }

    const { token: t, address: a } = JSON.parse(saved);
    setToken(t);
    setAddress(a);

    let cancelled = false;
    getAgentInfo(t)
      .then((info) => {
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
      setError("");
      setLoading(true);
      const { deployAgent } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        const ec = await import("@/lib/eigencompute");
        clients = await ec.createClients();
        setWalletClients(clients);
      }
      const mnemonic = generateMnemonic(wordlist);
      const envVars: Record<string, string> = {
        MNEMONIC: mnemonic,
        BACKEND_URL: window.location.origin,
        AGENT_SOUL: selectedSoul.content,
      };
      if (grantCredentials) {
        envVars.EIGENAI_GRANT_MESSAGE = grantCredentials.message;
        envVars.EIGENAI_GRANT_SIGNATURE = grantCredentials.signature;
        envVars.EIGENAI_WALLET_ADDRESS = grantCredentials.walletAddress;
      }
      const ecloudName = `clawt-${address.slice(2, 10).toLowerCase()}`;
      const deployResult = await deployAgent(clients, envVars, { name: ecloudName, token });
      await registerAgent(token, { name: agentName, appId: deployResult.appId });
      await checkAgent(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLifecycle(action: "start" | "stop" | "terminate") {
    try {
      setLoading(true);
      setError("");
      const { sendLifecycleTx, createClients } = await import("@/lib/eigencompute");
      let clients = walletClients;
      if (!clients) {
        clients = await createClients();
        setWalletClients(clients);
      }
      if (!agentInfo?.appId) throw new Error("No app ID");
      await sendLifecycleTx(clients, action, agentInfo.appId as `0x${string}`);
      const newStatus = action === "terminate" ? "terminated" : action === "stop" ? "stopped" : "running";
      await updateAgentStatus(token, { status: newStatus });
      if (action === "terminate") {
        setAgentInfo(null);
        setSetupStep(1);
        setView("setup");
        runPreflightChecks(address, walletClients?.walletClient, token);
      } else {
        setAgentInfo((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
    { id: "evolution", label: "Evolution" },
    { id: "tools", label: "Tools & Skills" },
    { id: "identity", label: "Identity" },
    { id: "audit", label: "Audit Log" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold tracking-tight">CLAWT</h1>
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
            <p className="mb-8 text-muted-foreground">
              Sign in with your Ethereum wallet to deploy a verifiable, self-evolving AI agent in a Trusted Execution Environment on EigenCompute.
            </p>
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
            <p className="mb-6 text-sm text-muted-foreground">Verify EigenCloud billing and EigenAI grant before deploying.</p>
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-5">
                <div className="mb-2 flex items-center gap-2">
                  {billingActive ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">&#10003;</span>
                  ) : !walletClients ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs">?</span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">&#10005;</span>
                  )}
                  <h3 className="text-sm font-medium">EigenCloud Billing</h3>
                </div>
                {billingActive ? (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p>Subscription active</p>
                    {billingManageUrl && <a href={billingManageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary underline">Manage billing</a>}
                  </div>
                ) : !walletClients ? (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">Sign with your wallet to verify billing status.</p>
                    <button onClick={handleResign} disabled={resigning} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                      {resigning ? "Signing..." : "Verify Wallet"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">No active subscription found.</p>
                    {billingError && <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 font-mono text-xs text-red-700 break-all">{billingError}</div>}
                    <Link href="/eigen-setup" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                      Set up EigenCloud account
                    </Link>
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
                  <h3 className="text-sm font-medium">EigenAI Grant</h3>
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
                    <p>No EigenAI grant found. <a href="https://determinal.eigenarcade.com/" target="_blank" rel="noreferrer" className="text-primary underline">Get one at EigenArcade</a>.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => runPreflightChecks(address, walletClients?.walletClient, token)} disabled={checkingPreflight} className="rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50">
                {checkingPreflight ? "Checking..." : "Check Again"}
              </button>
              <button onClick={() => { setSetupStep(2); fetchPurchasedSouls(); }} disabled={!billingActive || !grantCredentials} className="flex-1 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                Continue
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
            <button onClick={() => setSetupStep(2)} className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground">&larr; Back</button>
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
              className="mb-4 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
            <button onClick={handleDeploy} disabled={!agentName || loading} className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? "Deploying (confirm in MetaMask)..." : "Deploy"}
            </button>
          </div>
        )}

        {/* ── Dashboard ── */}
        {view === "dashboard" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{agentInfo?.name ?? "Your Agent"}</h2>
                {agentInfo?.walletAddressEth && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{agentInfo.walletAddressEth}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  agentStatus === "running" ? "bg-green-100 text-green-700"
                    : agentStatus === "stopped" ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                }`}>
                  {agentStatus}
                </span>
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
                  <StatCard label="Evolved Tools" value={evolution?.stats.evolvedTools ?? 0} />
                  <StatCard label="Evolved Skills" value={evolution?.stats.evolvedSkills ?? 0} />
                  <StatCard label="Risk Score" value={evolution?.stats.totalRisk ?? 0} />
                </div>

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

            {/* ── Evolution Tab ── */}
            {dashTab === "evolution" && (
              <div className="space-y-6">
                {evolution && evolution.recentLog.length > 0 ? (
                  <div className="space-y-0">
                    <h3 className="mb-4 text-sm font-medium">Activity Timeline</h3>
                    <div className="relative border-l-2 border-border pl-6">
                      {evolution.recentLog
                        .slice()
                        .reverse()
                        .map((entry: EvolutionLogEntry, i: number) => (
                          <div key={i} className="relative mb-5 last:mb-0">
                            <div className="absolute -left-[31px] top-1">
                              <ActionIcon action={entry.action} />
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm">{entry.summary}</p>
                                {entry.path && (
                                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{entry.path}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <RiskBadge score={entry.riskScore} />
                                <span className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No evolution activity yet. Your agent will start evolving as it handles tasks.
                  </div>
                )}

                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-3 text-sm font-medium">Stats</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div><span className="text-muted-foreground">Total modifications:</span> <span className="font-medium">{evolution?.stats.totalModifications ?? 0}</span></div>
                    <div><span className="text-muted-foreground">Tools synthesized:</span> <span className="font-medium">{evolution?.stats.evolvedTools ?? 0}</span></div>
                    <div><span className="text-muted-foreground">Skills created:</span> <span className="font-medium">{evolution?.stats.evolvedSkills ?? 0}</span></div>
                    <div><span className="text-muted-foreground">Packages installed:</span> <span className="font-medium">{evolution?.stats.packagesInstalled ?? 0}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tools & Skills Tab ── */}
            {dashTab === "tools" && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Evolved Tools</h3>
                  {skills.filter((s) => s.author === "self").length > 0 ? (
                    <div className="space-y-2">
                      {skills
                        .filter((s) => s.author === "self")
                        .map((s) => (
                          <div key={s.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">evolved</span>
                              <span className="text-sm font-medium">{s.id}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No evolved tools yet. As your agent handles tasks, it will synthesize reusable tools for recurring patterns.
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium">Registry Skills</h3>
                  {skills.filter((s) => s.author !== "self").length > 0 ? (
                    <div className="space-y-2">
                      {skills
                        .filter((s) => s.author !== "self")
                        .map((s) => (
                          <div key={s.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{s.id}</span>
                              <span className="text-[10px] text-muted-foreground">v{s.version}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No registry skills loaded.
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
                  <p className="mb-3 text-xs text-muted-foreground">Core identity and values. Chosen at deployment.</p>
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

            {/* ── Audit Log Tab ── */}
            {dashTab === "audit" && (
              <div className="space-y-4">
                {agentInfo?.walletAddressEth && (
                  <p className="text-xs text-muted-foreground">
                    {evolution?.stats.totalModifications ?? 0} modifications, all signed by TEE wallet{" "}
                    <span className="font-mono">{agentInfo.walletAddressEth.slice(0, 10)}...{agentInfo.walletAddressEth.slice(-6)}</span>
                  </p>
                )}

                {evolution && evolution.recentLog.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Time</th>
                          <th className="px-3 py-2 text-left font-medium">Action</th>
                          <th className="px-3 py-2 text-left font-medium">Summary</th>
                          <th className="px-3 py-2 text-left font-medium">Risk</th>
                          <th className="px-3 py-2 text-left font-medium">Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evolution.recentLog
                          .slice()
                          .reverse()
                          .map((entry: EvolutionLogEntry, i: number) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{timeAgo(entry.timestamp)}</td>
                              <td className="px-3 py-2 font-medium">{entry.action}</td>
                              <td className="max-w-[250px] truncate px-3 py-2">{entry.summary}</td>
                              <td className="px-3 py-2"><RiskBadge score={entry.riskScore} /></td>
                              <td className="px-3 py-2 font-mono text-muted-foreground">
                                {entry.signature.slice(0, 10)}...{entry.signature.slice(-6)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No audit entries yet.
                  </div>
                )}
              </div>
            )}

            {/* ── Settings Tab ── */}
            {dashTab === "settings" && (
              <div className="space-y-6">
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
