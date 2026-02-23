"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { hasMetaMask, connectWallet, signSiweMessage, signBillingAuth, signGrantMessage } from "@/lib/wallet";
import {
  verifyAuth,
  getAgentInfo,
  registerAgent,
  updateAgentStatus,
  submitTask,
  getGrantStatus,
  getBillingStatus,
  subscribeToBilling,
} from "@/lib/api";
import type { AgentInfo } from "@/lib/api";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

type View = "landing" | "setup" | "dashboard" | "loading";

interface SiweCredentials {
  message: string;
  signature: string;
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

  const [setupStep, setSetupStep] = useState<1 | 2>(1);
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

  const checkAgent = useCallback(async (t: string) => {
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
  }, []);

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
      return {
        active: false,
        error: err instanceof Error ? err.message : String(err),
      };
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
        setGrantStatus({
          checked: true,
          hasGrant: grant.hasGrant,
          tokenCount: grant.tokenCount,
        });
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
      const { message, signature } = await signSiweMessage(
        addr as `0x${string}`,
        walletClient
      );
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
      setGrantCredentials({
        message: grantMessage,
        signature: grantSignature,
        walletAddress: address,
      });
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
    const billingReturn = params.get("billing");
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
            if (cancelled) return;
            setGrantStatus({
              checked: true,
              hasGrant: grant.hasGrant,
              tokenCount: grant.tokenCount,
            });
          })
          .catch(() => {
            if (!cancelled) {
              setGrantStatus({ checked: true, hasGrant: false, tokenCount: 0 });
            }
          });
      })
      .catch(() => {
        if (!cancelled) setView("landing");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    try {
      setError("");
      setLoading(true);
      const { address: addr, walletClient, publicClient } = await connectWallet();
      setWalletClients({ walletClient, publicClient, address: addr as `0x${string}` });

      const { message, signature } = await signSiweMessage(
        addr as `0x${string}`,
        walletClient
      );
      setSiweCredentials({ message, signature });

      const { token: t, hasAgent } = await verifyAuth(message, signature);
      localStorage.setItem(
        "clawt-session",
        JSON.stringify({ token: t, address: addr })
      );
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

  async function handleSubscribe() {
    if (!walletClients || !token) return;
    try {
      setLoading(true);
      const auth = await signBillingAuth(address as `0x${string}`, walletClients.walletClient);
      const result = await subscribeToBilling(token, auth);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      if (result.alreadyActive) {
        setBillingActive(true);
        await runPreflightChecks(address, walletClients.walletClient, token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        const c = await ec.createClients();
        clients = c;
        setWalletClients(c);
      }

      const mnemonic = generateMnemonic(wordlist);

      const envVars: Record<string, string> = {
        MNEMONIC: mnemonic,
        BACKEND_URL: window.location.origin,
      };
      if (grantCredentials) {
        envVars.EIGENAI_GRANT_MESSAGE = grantCredentials.message;
        envVars.EIGENAI_GRANT_SIGNATURE = grantCredentials.signature;
        envVars.EIGENAI_WALLET_ADDRESS = grantCredentials.walletAddress;
      }

      const ecloudName = `clawt-${address.slice(2, 10).toLowerCase()}`;
      const deployResult = await deployAgent(clients, envVars, {
        name: ecloudName,
        token,
      });

      await registerAgent(token, {
        name: agentName,
        appId: deployResult.appId,
      });

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

      const newStatus =
        action === "terminate" ? "terminated" : action === "stop" ? "stopped" : "running";
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

  function handleDisconnect() {
    localStorage.removeItem("clawt-session");
    setAddress("");
    setToken("");
    setAgentInfo(null);
    setSiweCredentials(null);
    setWalletClients(null);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">CLAWT</h1>
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

      <main className="mx-auto max-w-4xl px-6 py-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        {view === "landing" && (
          <div className="mx-auto max-w-md pt-20 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h2 className="mb-3 text-2xl font-semibold">Deploy Your Own AI Agent</h2>
            <p className="mb-8 text-muted-foreground">
              Sign in with your Ethereum wallet to deploy a verifiable AI agent with its own TEE wallet on EigenCompute.
            </p>
            {hasMetaMask() ? (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : (
              <p className="text-muted-foreground">
                Please install{" "}
                <a href="https://metamask.io" className="text-primary underline" target="_blank" rel="noreferrer">
                  MetaMask
                </a>{" "}
                to continue.
              </p>
            )}
          </div>
        )}

        {view === "setup" && setupStep === 1 && (
          <div className="mx-auto max-w-lg pt-10">
            <h2 className="mb-1 text-xl font-semibold">Pre-Deploy Checks</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Before deploying your agent, we need to verify your EigenCloud billing and EigenAI grant.
            </p>

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
                    {billingManageUrl && (
                      <a
                        href={billingManageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-primary underline"
                      >
                        Manage billing
                      </a>
                    )}
                  </div>
                ) : !walletClients ? (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">
                      Sign with your wallet to verify your billing status with EigenCloud.
                    </p>
                    <button
                      onClick={handleResign}
                      disabled={resigning}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {resigning ? "Signing..." : "Verify Wallet"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p className="mb-2">No active EigenCloud subscription found.</p>
                    {billingError && (
                      <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 font-mono text-xs text-red-700 break-all whitespace-pre-wrap">
                        {billingError}
                      </div>
                    )}
                    <button
                      onClick={handleSubscribe}
                      disabled={loading}
                      className="mb-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? "Opening Stripe..." : "Subscribe via Stripe"}
                    </button>
                    <br />
                    <a
                      href="https://docs.eigencloud.xyz/eigencompute/get-started/billing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      View billing documentation
                    </a>
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
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p>Grant authorized{grantStatus.tokenCount > 0 ? ` (${grantStatus.tokenCount.toLocaleString()} tokens)` : ""}</p>
                  </div>
                ) : grantStatus.hasGrant ? (
                  <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Sign a message to authorize your agent to use your EigenAI grant.
                      This signature is encrypted and only accessible inside the TEE.
                    </p>
                    <button
                      onClick={handleSignGrant}
                      disabled={signingGrant}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {signingGrant ? "Signing..." : "Sign Authorization"}
                    </button>
                  </div>
                ) : (
                  <div className="ml-7 text-sm text-muted-foreground">
                    <p>
                      Your wallet doesn&apos;t have an EigenAI grant.{" "}
                      <a
                        href="https://determinal.eigenarcade.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Get one at EigenArcade
                      </a>
                      , then return here.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => runPreflightChecks(address, walletClients?.walletClient, token)}
                disabled={checkingPreflight}
                className="rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                {checkingPreflight ? "Checking..." : "Check Again"}
              </button>
              <button
                onClick={() => setSetupStep(2)}
                disabled={!billingActive || !grantCredentials}
                className="flex-1 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {view === "setup" && setupStep === 2 && (
          <div className="mx-auto max-w-md pt-10">
            <button
              onClick={() => setSetupStep(1)}
              className="mb-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; Back to checks
            </button>
            <h2 className="mb-1 text-xl font-semibold">Deploy Agent</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Give your agent a name and deploy it to EigenCompute. MetaMask will ask you to sign 2-3 transactions.
            </p>
            <input
              type="text"
              placeholder="Agent name (e.g. my-defi-agent)"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
            <button
              onClick={handleDeploy}
              disabled={!agentName || loading}
              className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Deploying (confirm in MetaMask)..." : "Deploy"}
            </button>
          </div>
        )}

        {view === "dashboard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{agentInfo?.name ?? "Your Agent"}</h2>
                {agentInfo?.walletAddressEth && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{agentInfo.walletAddressEth}</p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  agentStatus === "running"
                    ? "bg-green-100 text-green-700"
                    : agentStatus === "stopped"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {agentStatus}
              </span>
            </div>

            <div className="flex gap-2">
              {agentStatus === "running" ? (
                <button
                  onClick={() => handleLifecycle("stop")}
                  disabled={loading}
                  className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => handleLifecycle("start")}
                  disabled={loading}
                  className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Start
                </button>
              )}
              <button
                onClick={() => handleLifecycle("terminate")}
                disabled={loading}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Terminate
              </button>
            </div>

            <div className="rounded-lg border border-border p-5">
              <h3 className="mb-3 text-sm font-medium">Submit Task</h3>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="What do you want your agent to do?"
                className="mb-3 h-32 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
              />
              <button
                onClick={handleTask}
                disabled={!task || agentStatus !== "running" || loading}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>

            {result && (
              <div className="rounded-lg border border-border bg-muted/50 p-5">
                <h3 className="mb-2 text-sm font-medium">Result</h3>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
                  {result}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
