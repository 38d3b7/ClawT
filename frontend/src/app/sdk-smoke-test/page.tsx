"use client";

import { useState } from "react";
import { EIGEN_CHAIN, EIGEN_ENVIRONMENT, KMS_BUILD } from "@/lib/network-config";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warn" | "running";
  detail: string;
  ms?: number;
}

export default function SdkSmokeTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionResults, setSessionResults] = useState<TestResult[]>([]);
  const [sessionRunning, setSessionRunning] = useState(false);

  function update(
    setter: typeof setResults,
    name: string,
    patch: Partial<TestResult>
  ) {
    setter((prev) => prev.map((r) => (r.name === name ? { ...r, ...patch } : r)));
  }

  async function runOfflineTests() {
    setRunning(true);
    const tests: TestResult[] = [
      { name: "Import browser SDK", status: "running", detail: "" },
      { name: "getEnvironmentConfig", status: "running", detail: "" },
      { name: "getKMSKeysForEnvironment", status: "running", detail: "" },
      { name: "encryptRSAOAEPAndAES256GCM", status: "running", detail: "" },
      { name: "getAvailableEnvironments", status: "running", detail: "" },
      { name: "createSiweMessage", status: "running", detail: "" },
    ];
    setResults(tests);

    let sdk: typeof import("@layr-labs/ecloud-sdk/browser") | null = null;
    const t0 = performance.now();
    try {
      sdk = await import("@layr-labs/ecloud-sdk/browser");
      const exportNames = Object.keys(sdk).sort();
      update(setResults, "Import browser SDK", {
        status: "pass",
        detail: `${exportNames.length} exports: ${exportNames.slice(0, 10).join(", ")}...`,
        ms: Math.round(performance.now() - t0),
      });
    } catch (err) {
      update(setResults, "Import browser SDK", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
        ms: Math.round(performance.now() - t0),
      });
      setRunning(false);
      return;
    }

    try {
      const t1 = performance.now();
      const config = sdk.getEnvironmentConfig(EIGEN_ENVIRONMENT);
      update(setResults, "getEnvironmentConfig", {
        status: "pass",
        detail: `name=${config.name}, chainID=${config.chainID}, userAPI=${config.userApiServerURL}`,
        ms: Math.round(performance.now() - t1),
      });
    } catch (err) {
      update(setResults, "getEnvironmentConfig", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    let encryptionKey: Buffer | null = null;
    try {
      const t2 = performance.now();
      const keys = sdk.getKMSKeysForEnvironment(EIGEN_ENVIRONMENT, KMS_BUILD);
      encryptionKey = keys.encryptionKey;
      update(setResults, "getKMSKeysForEnvironment", {
        status: "pass",
        detail: `encryptionKey: ${keys.encryptionKey.length}B, signingKey: ${keys.signingKey.length}B`,
        ms: Math.round(performance.now() - t2),
      });
    } catch (err) {
      update(setResults, "getKMSKeysForEnvironment", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    if (encryptionKey) {
      try {
        const t3 = performance.now();
        const dummyPayload = Buffer.from(
          JSON.stringify({
            MNEMONIC: "abandon ".repeat(11) + "about",
            EIGENAI_GRANT_MESSAGE: "test",
          })
        );
        const jwe = await sdk.encryptRSAOAEPAndAES256GCM(
          encryptionKey,
          dummyPayload,
          sdk.getAppProtectedHeaders("0x0000000000000000000000000000000000000001")
        );
        update(setResults, "encryptRSAOAEPAndAES256GCM", {
          status: "pass",
          detail: `JWE: ${jwe.length} chars`,
          ms: Math.round(performance.now() - t3),
        });
      } catch (err) {
        update(setResults, "encryptRSAOAEPAndAES256GCM", {
          status: "fail",
          detail: err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
        });
      }
    } else {
      update(setResults, "encryptRSAOAEPAndAES256GCM", {
        status: "fail",
        detail: "Skipped: no encryptionKey",
      });
    }

    try {
      const t4 = performance.now();
      const envs = sdk.getAvailableEnvironments();
      update(setResults, "getAvailableEnvironments", {
        status: "pass",
        detail: envs.join(", "),
        ms: Math.round(performance.now() - t4),
      });
    } catch (err) {
      update(setResults, "getAvailableEnvironments", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const t5 = performance.now();
      const siwe = sdk.createSiweMessage({
        address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        chainId: 11155111,
        domain: window.location.host,
        uri: window.location.origin,
      });
      update(setResults, "createSiweMessage", {
        status: "pass",
        detail: `${siwe.message.length} chars, nonce: ${siwe.params.nonce}`,
        ms: Math.round(performance.now() - t5),
      });
    } catch (err) {
      update(setResults, "createSiweMessage", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    setRunning(false);
  }

  function fmtErr(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null) return JSON.stringify(err, null, 2);
    return String(err);
  }

  async function runSessionTest() {
    setSessionRunning(true);
    const tests: TestResult[] = [
      { name: "Connect MetaMask", status: "running", detail: "" },
      { name: "Create viem clients", status: "running", detail: "" },
      { name: "Sign SIWE message", status: "running", detail: "" },
      { name: "Login: Compute API", status: "running", detail: "" },
      { name: "Login: Billing API", status: "running", detail: "" },
      { name: "Cookie: Compute session", status: "running", detail: "" },
      { name: "Cookie: Billing session", status: "running", detail: "" },
      { name: "Billing: getSubscription", status: "running", detail: "" },
    ];
    setSessionResults(tests);

    const u = (name: string, patch: Partial<TestResult>) =>
      update(setSessionResults, name, patch);

    const sdk = await import("@layr-labs/ecloud-sdk/browser");
    const viem = await import("viem");

    // Step 1: Connect MetaMask
    let address: `0x${string}`;
    try {
      const t0 = performance.now();
      if (!window.ethereum) throw new Error("MetaMask not found");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.[0]) throw new Error("No accounts returned");
      address = viem.getAddress(accounts[0]) as `0x${string}`;
      u("Connect MetaMask", {
        status: "pass",
        detail: address,
        ms: Math.round(performance.now() - t0),
      });
    } catch (err) {
      u("Connect MetaMask", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
      setSessionRunning(false);
      return;
    }

    // Step 2: Create viem clients
    let walletClient: ReturnType<typeof viem.createWalletClient>;
    let publicClient: ReturnType<typeof viem.createPublicClient>;
    try {
      const t1 = performance.now();
      walletClient = viem.createWalletClient({
        account: address,
        chain: EIGEN_CHAIN,
        transport: viem.custom(window.ethereum),
      });
      publicClient = viem.createPublicClient({
        chain: EIGEN_CHAIN,
        transport: viem.custom(window.ethereum),
      });
      u("Create viem clients", {
        status: "pass",
        detail: `wallet: ${walletClient.account?.address}, chain: ${EIGEN_CHAIN.name}`,
        ms: Math.round(performance.now() - t1),
      });
    } catch (err) {
      u("Create viem clients", {
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
      setSessionRunning(false);
      return;
    }

    // Step 3: Create + sign SIWE message
    let siweMessage: string;
    let signature: `0x${string}`;
    try {
      const t2 = performance.now();
      const siwe = sdk.createSiweMessage({
        address,
        chainId: EIGEN_CHAIN.id,
        domain: window.location.host,
        uri: window.location.origin,
        statement: "Sign in to CLAWT (cookie test)",
      });
      siweMessage = siwe.message;
      signature = await walletClient.signMessage({
        account: address,
        message: siweMessage,
      });
      u("Sign SIWE message", {
        status: "pass",
        detail: `sig: ${signature.slice(0, 20)}...`,
        ms: Math.round(performance.now() - t2),
      });
    } catch (err: unknown) {
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err, null, 2)
            : String(err);
      u("Sign SIWE message", {
        status: "fail",
        detail,
      });
      setSessionRunning(false);
      return;
    }

    // Step 4: Login to compute API (separate from billing to isolate CORS issues)
    const envConfig = sdk.getEnvironmentConfig(EIGEN_ENVIRONMENT);
    const billingConfig = sdk.getBillingEnvironmentConfig("prod");
    let computeLoginOk = false;
    let billingLoginOk = false;

    try {
      const t3 = performance.now();
      const result = await sdk.loginToComputeApi(
        { baseUrl: envConfig.userApiServerURL },
        { message: siweMessage, signature }
      );
      computeLoginOk = true;
      u("Login: Compute API", {
        status: "pass",
        detail: `${envConfig.userApiServerURL} → ${JSON.stringify(result)}`,
        ms: Math.round(performance.now() - t3),
      });
    } catch (err: unknown) {
      u("Login: Compute API", { status: "fail", detail: fmtErr(err) });
    }

    // Step 5: Login to billing API (separate)
    try {
      const t4 = performance.now();
      const result = await sdk.loginToBillingApi(
        { baseUrl: billingConfig.billingApiServerURL },
        { message: siweMessage, signature }
      );
      billingLoginOk = true;
      u("Login: Billing API", {
        status: "pass",
        detail: `${billingConfig.billingApiServerURL} → ${JSON.stringify(result)}`,
        ms: Math.round(performance.now() - t4),
      });
    } catch (err: unknown) {
      u("Login: Billing API", { status: "fail", detail: fmtErr(err) });
    }

    // Step 6: Verify compute session persisted (cookie test)
    if (computeLoginOk) {
      try {
        const t5 = performance.now();
        const session = await sdk.getComputeApiSession({
          baseUrl: envConfig.userApiServerURL,
        });
        const passed = session.authenticated === true;
        u("Cookie: Compute session", {
          status: passed ? "pass" : "fail",
          detail: passed
            ? `authenticated=true, address=${session.address}, chainId=${session.chainId}`
            : `authenticated=false — COOKIE NOT PERSISTED. ${JSON.stringify(session)}`,
          ms: Math.round(performance.now() - t5),
        });
      } catch (err: unknown) {
        u("Cookie: Compute session", { status: "fail", detail: fmtErr(err) });
      }
    } else {
      u("Cookie: Compute session", { status: "fail", detail: "Skipped: compute login failed" });
    }

    // Step 7: Verify billing session persisted (cookie test)
    if (billingLoginOk) {
      try {
        const t6 = performance.now();
        const valid = await sdk.isBillingSessionValid({
          baseUrl: billingConfig.billingApiServerURL,
        });
        u("Cookie: Billing session", {
          status: valid ? "pass" : "fail",
          detail: valid
            ? "Session valid — cookies working cross-origin"
            : "Session invalid — COOKIE NOT PERSISTED",
          ms: Math.round(performance.now() - t6),
        });
      } catch (err: unknown) {
        u("Cookie: Billing session", { status: "fail", detail: fmtErr(err) });
      }
    } else {
      u("Cookie: Billing session", { status: "fail", detail: "Skipped: billing login failed" });
    }

    // Step 8: Try an actual billing API call with session auth
    if (billingLoginOk) {
      try {
        const t7 = performance.now();
        const billingClient = new sdk.BillingApiClient(
          { billingApiServerURL: billingConfig.billingApiServerURL },
          walletClient,
          { useSession: true }
        );
        const sub = await billingClient.getSubscription("compute", {
          returnUrl: window.location.href,
        });
        u("Billing: getSubscription", {
          status: "pass",
          detail: JSON.stringify(sub, null, 2).slice(0, 500),
          ms: Math.round(performance.now() - t7),
        });
      } catch (err: unknown) {
        u("Billing: getSubscription", { status: "fail", detail: fmtErr(err) });
      }
    } else {
      u("Billing: getSubscription", { status: "fail", detail: "Skipped: billing login failed" });
    }

    setSessionRunning(false);
  }

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const sPassCount = sessionResults.filter((r) => r.status === "pass").length;
  const sFailCount = sessionResults.filter((r) => r.status === "fail").length;

  function statusBg(s: string) {
    if (s === "pass") return "border-green-200 bg-green-50";
    if (s === "fail") return "border-red-200 bg-red-50";
    if (s === "warn") return "border-yellow-200 bg-yellow-50";
    return "border-border bg-muted/30";
  }
  function statusIcon(s: string) {
    if (s === "pass") return "\u2705";
    if (s === "fail") return "\u274c";
    if (s === "warn") return "\u26a0\ufe0f";
    return "\u23f3";
  }

  function renderResults(items: TestResult[]) {
    return (
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.name} className={`rounded-lg border p-4 ${statusBg(r.status)}`}>
            <div className="flex items-center gap-2">
              <span className="text-base">{statusIcon(r.status)}</span>
              <span className="text-sm font-medium">{r.name}</span>
              {r.ms !== undefined && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">{r.ms}ms</span>
              )}
            </div>
            {r.detail && (
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-foreground/70">
                {r.detail}
              </pre>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="mb-2 text-2xl font-semibold">SDK Browser Smoke Test</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Phase 1: Offline tests (no wallet needed). Phase 2: Session cookie test (requires MetaMask).
          </p>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-medium">Phase 1: Offline SDK Tests</h2>
          <button
            onClick={runOfflineTests}
            disabled={running}
            className="mb-4 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {running ? "Running..." : results.length > 0 ? "Run Again" : "Run Offline Tests"}
          </button>
          {results.length > 0 && (
            <div className="mb-2 text-sm">
              {passCount > 0 && <span className="mr-3 text-green-600">{passCount} passed</span>}
              {failCount > 0 && <span className="mr-3 text-red-600">{failCount} failed</span>}
            </div>
          )}
          {renderResults(results)}
        </section>

        <section>
          <h2 className="mb-1 text-lg font-medium">Phase 2: Session Cookie Test</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Connects MetaMask, signs SIWE, calls loginToBothApis, then verifies if session cookies
            persisted cross-origin. This is the third-party cookie risk check.
          </p>
          <button
            onClick={runSessionTest}
            disabled={sessionRunning}
            className="mb-4 rounded-lg border border-primary bg-background px-6 py-2.5 font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            {sessionRunning
              ? "Running (check MetaMask)..."
              : sessionResults.length > 0
                ? "Run Again"
                : "Run Session Test"}
          </button>
          {sessionResults.length > 0 && (
            <div className="mb-2 text-sm">
              {sPassCount > 0 && <span className="mr-3 text-green-600">{sPassCount} passed</span>}
              {sFailCount > 0 && <span className="mr-3 text-red-600">{sFailCount} failed</span>}
            </div>
          )}
          {renderResults(sessionResults)}
        </section>
      </div>
    </div>
  );
}
