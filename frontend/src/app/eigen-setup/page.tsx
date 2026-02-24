"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { hasMetaMask, connectWallet, signBillingAuth } from "@/lib/wallet";
import { getBillingStatus, subscribeToBilling } from "@/lib/api";
import Link from "next/link";

type Step = "connect" | "checking" | "subscribe" | "redirecting" | "confirming" | "done";

export default function EigenSetup() {
  const [step, setStep] = useState<Step>("connect");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletRef = useRef<any>(null);
  const tokenRef = useRef("");
  const initRef = useRef(false);

  const checkBilling = useCallback(async () => {
    if (!walletRef.current || !tokenRef.current) return false;
    try {
      const auth = await signBillingAuth(
        walletRef.current.address as `0x${string}`,
        walletRef.current.walletClient
      );
      const status = await getBillingStatus(tokenRef.current, auth);
      if (status.portalUrl) setPortalUrl(status.portalUrl);
      return status.active;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "complete") {
      window.history.replaceState({}, "", window.location.pathname);
      setStep("confirming");

      const saved = localStorage.getItem("clawt-session");
      if (saved) {
        const { address: a } = JSON.parse(saved);
        setAddress(a);
      }
    }
  }, []);

  async function handleConnect() {
    setError("");
    try {
      const { address: addr, walletClient, publicClient } = await connectWallet();
      walletRef.current = { walletClient, publicClient, address: addr };
      setAddress(addr);

      const saved = localStorage.getItem("clawt-session");
      if (saved) {
        const { token: t } = JSON.parse(saved);
        tokenRef.current = t;
      }

      if (!tokenRef.current) {
        const { signSiweMessage } = await import("@/lib/wallet");
        const { verifyAuth } = await import("@/lib/api");
        const { message, signature } = await signSiweMessage(
          addr as `0x${string}`,
          walletClient
        );
        const { token: t } = await verifyAuth(message, signature);
        localStorage.setItem("clawt-session", JSON.stringify({ token: t, address: addr }));
        tokenRef.current = t;
      }

      setStep("checking");
      const active = await checkBilling();
      if (active) {
        setStep("done");
      } else {
        setStep("subscribe");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReconnectAndVerify() {
    setError("");
    try {
      const { address: addr, walletClient, publicClient } = await connectWallet();
      walletRef.current = { walletClient, publicClient, address: addr };
      setAddress(addr);

      const saved = localStorage.getItem("clawt-session");
      if (saved) {
        const { token: t } = JSON.parse(saved);
        tokenRef.current = t;
      }

      if (!tokenRef.current) {
        const { signSiweMessage } = await import("@/lib/wallet");
        const { verifyAuth } = await import("@/lib/api");
        const { message, signature } = await signSiweMessage(
          addr as `0x${string}`,
          walletClient
        );
        const { token: t } = await verifyAuth(message, signature);
        localStorage.setItem("clawt-session", JSON.stringify({ token: t, address: addr }));
        tokenRef.current = t;
      }

      const active = await checkBilling();
      if (active) {
        setStep("done");
      } else {
        setError(
          "Subscription not yet active. If you just completed payment, it may take a moment. Try again."
        );
        setStep("subscribe");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("subscribe");
    }
  }

  async function handleSubscribe() {
    setError("");
    try {
      setStep("redirecting");
      const auth = await signBillingAuth(
        walletRef.current.address as `0x${string}`,
        walletRef.current.walletClient
      );
      const res = await subscribeToBilling(tokenRef.current, auth);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res.alreadyActive) {
        setStep("done");
        return;
      }
      setError("Could not get checkout URL. Please try again.");
      setStep("subscribe");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("subscribe");
    }
  }

  const stepNumber = (s: Step): number => {
    if (s === "connect") return 1;
    if (s === "checking") return 2;
    if (s === "subscribe" || s === "redirecting") return 2;
    if (s === "confirming") return 3;
    if (s === "done") return 3;
    return 1;
  };

  const currentStep = stepNumber(step);

  function StepIndicator({ n, label }: { n: number; label: string }) {
    const isActive = n === currentStep;
    const isComplete = n < currentStep;
    return (
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
            isComplete
              ? "bg-green-100 text-green-700"
              : isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isComplete ? "\u2713" : n}
        </span>
        <span className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            CLAWT
          </Link>
          {address && (
            <span className="rounded-lg bg-muted px-3 py-1.5 font-mono text-xs">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-semibold">Set Up EigenCloud</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Your AI agent runs on EigenCloud infrastructure. Connect your wallet and set up billing to
          get started. This is the same wallet you&apos;ll use to deploy your agent.
        </p>

        <div className="mb-8 flex gap-6">
          <StepIndicator n={1} label="Connect wallet" />
          <StepIndicator n={2} label="Set up billing" />
          <StepIndicator n={3} label="Confirmed" />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError("")} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        {step === "connect" && (
          <div className="rounded-lg border border-border p-8">
            <h2 className="mb-2 text-lg font-medium">Connect Your Wallet</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Connect the MetaMask wallet you want to use with EigenCloud. This wallet address
              becomes your EigenCloud identity.
            </p>
            {hasMetaMask() ? (
              <button
                onClick={handleConnect}
                className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Connect MetaMask
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Please install{" "}
                <a
                  href="https://metamask.io"
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  MetaMask
                </a>{" "}
                to continue.
              </p>
            )}
          </div>
        )}

        {step === "checking" && (
          <div className="rounded-lg border border-border p-8 text-center">
            <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Checking billing status...</p>
          </div>
        )}

        {step === "subscribe" && (
          <div className="rounded-lg border border-border p-8">
            <h2 className="mb-2 text-lg font-medium">Set Up Billing</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              EigenCloud uses metered billing at $0.00177 per vCPU hour. All new customers receive a{" "}
              <span className="font-medium text-foreground">$100 credit</span>.
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              You&apos;ll be taken to EigenCloud&apos;s payment page to enter your card details and
              activate your subscription.
            </p>
            <button
              onClick={handleSubscribe}
              className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Set Up Billing
            </button>
          </div>
        )}

        {step === "redirecting" && (
          <div className="rounded-lg border border-border p-8 text-center">
            <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Redirecting to EigenCloud billing...
            </p>
          </div>
        )}

        {step === "confirming" && (
          <div className="rounded-lg border border-border p-8">
            <h2 className="mb-2 text-lg font-medium">Confirm Your Subscription</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Reconnect your wallet to verify your billing subscription is active.
            </p>
            {hasMetaMask() ? (
              <button
                onClick={handleReconnectAndVerify}
                className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Verify Subscription
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">MetaMask not detected.</p>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm">
                &#10003;
              </span>
              <h2 className="text-lg font-medium text-green-900">Billing Active</h2>
            </div>
            <p className="mb-6 text-sm text-green-800">
              Your EigenCloud subscription is set up. You can now deploy your AI agent.
            </p>
            <div className="flex gap-3">
              <Link
                href="/"
                className="rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Continue to CLAWT
              </Link>
              {portalUrl && (
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Manage billing
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
