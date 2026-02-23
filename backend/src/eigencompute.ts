import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, chmodSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const EIGENCOMPUTE_PRIVATE_KEY = process.env.EIGENCOMPUTE_PRIVATE_KEY ?? "";
export const EIGENCOMPUTE_ENVIRONMENT = process.env.EIGENCOMPUTE_ENVIRONMENT ?? "sepolia";
const AGENT_IMAGE_REF = process.env.AGENT_IMAGE_REF ?? "clawt/agent:latest";

const SAFE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export interface EnvVar {
  key: string;
  value: string;
  isPublic: boolean;
}

export interface DeployResult {
  appId: string;
  walletAddressEth: string;
  walletAddressSol: string;
  instanceIp: string;
  dockerDigest: string;
}

function validateShellInput(input: string, label: string): string {
  if (!SAFE_NAME_RE.test(input)) {
    throw new Error(`Invalid ${label}`);
  }
  return input;
}

function escapeEnvValue(value: string): string {
  if (/[\n\r"'\\$`]/.test(value) || value.includes(" ")) {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
    return `"${escaped}"`;
  }
  return value;
}

function buildEnvFile(envVars: EnvVar[]): string {
  const lines: string[] = [];
  for (const { key, value, isPublic } of envVars) {
    if (!ENV_KEY_RE.test(key)) throw new Error(`Invalid env var key: ${key}`);
    const envKey = isPublic && !key.endsWith("_PUBLIC") ? `${key}_PUBLIC` : key;
    lines.push(`${envKey}=${escapeEnvValue(value)}`);
  }

  const secureDir = mkdtempSync(join(tmpdir(), "clawt-"));
  chmodSync(secureDir, 0o700);
  const filepath = join(secureDir, ".env");
  writeFileSync(filepath, lines.join("\n") + "\n", { mode: 0o600 });
  return filepath;
}

function sanitizeOutput(output: string): string {
  return output.replace(/0x[a-fA-F0-9]{64}/g, "[REDACTED]");
}

export function runEcloudCommand(command: string): string {
  const env = {
    ...process.env,
    EIGENCOMPUTE_PRIVATE_KEY,
  };

  try {
    const output = execSync(`echo "n" | ecloud ${command}`, {
      env,
      encoding: "utf-8",
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return output;
  } catch (err) {
    const error = err as { stderr?: string; message?: string };
    throw new Error(sanitizeOutput(error.stderr || error.message || "CLI failed"));
  }
}

function parseDeployOutput(output: string): Partial<DeployResult> {
  const appIdMatch = output.match(/App ID:\s*(0x[a-fA-F0-9]+)/i);
  const ethMatch = output.match(/EVM Address:\s*(0x[a-fA-F0-9]+)/i);
  const solMatch = output.match(/Solana Address:\s*(\w+)/i);
  const ipMatch = output.match(/IP:\s*(\d+\.\d+\.\d+\.\d+)/);
  const digestMatch = output.match(/Docker Digest:\s*(sha256:[a-f0-9]+)/i);

  return {
    appId: appIdMatch?.[1] ?? "",
    walletAddressEth: ethMatch?.[1] ?? "",
    walletAddressSol: solMatch?.[1] ?? "",
    instanceIp: ipMatch?.[1] ?? "",
    dockerDigest: digestMatch?.[1] ?? "",
  };
}

export async function deployAgent(
  name: string,
  envVars: EnvVar[],
  verifiable: boolean = false
): Promise<DeployResult> {
  const safeName = validateShellInput(name, "agent name");
  const envFilePath = buildEnvFile(envVars);

  try {
    const verifyFlag = verifiable ? "--verifiable" : "";
    const command = `compute app deploy --image-ref ${AGENT_IMAGE_REF} --env-file ${envFilePath} --environment ${EIGENCOMPUTE_ENVIRONMENT} --log-visibility private --resource-usage-monitoring enable --instance-type g1-standard-4t --skip-profile --name ${safeName} ${verifyFlag}`;

    console.log(`[CLI] Deploying: ${safeName}`);
    const output = runEcloudCommand(command);
    const parsed = parseDeployOutput(output);

    return {
      appId: parsed.appId ?? "",
      walletAddressEth: parsed.walletAddressEth ?? "",
      walletAddressSol: parsed.walletAddressSol ?? "",
      instanceIp: parsed.instanceIp ?? "",
      dockerDigest: parsed.dockerDigest ?? "",
    };
  } finally {
    try { unlinkSync(envFilePath); } catch { /* cleanup best-effort */ }
  }
}

export async function upgradeAgent(appId: string, envVars: EnvVar[]): Promise<void> {
  const safeAppId = validateShellInput(appId, "app ID");
  const envFilePath = buildEnvFile(envVars);

  try {
    const command = `compute app upgrade ${safeAppId} --image-ref ${AGENT_IMAGE_REF} --env-file ${envFilePath} --environment ${EIGENCOMPUTE_ENVIRONMENT}`;
    console.log(`[CLI] Upgrading: ${safeAppId}`);
    runEcloudCommand(command);
  } finally {
    try { unlinkSync(envFilePath); } catch { /* cleanup best-effort */ }
  }
}

export async function stopAgent(appId: string): Promise<void> {
  const safeAppId = validateShellInput(appId, "app ID");
  runEcloudCommand(`compute app stop ${safeAppId} --environment ${EIGENCOMPUTE_ENVIRONMENT}`);
}

export async function startAgent(appId: string): Promise<void> {
  const safeAppId = validateShellInput(appId, "app ID");
  runEcloudCommand(`compute app start ${safeAppId} --environment ${EIGENCOMPUTE_ENVIRONMENT}`);
}

export async function terminateAgent(appId: string): Promise<void> {
  const safeAppId = validateShellInput(appId, "app ID");
  runEcloudCommand(`compute app terminate ${safeAppId} --environment ${EIGENCOMPUTE_ENVIRONMENT}`);
}

export interface AppInfo {
  instanceIp: string;
  dockerDigest: string;
  walletAddressEth: string;
  walletAddressSol: string;
}

export async function getAppInfo(appId: string): Promise<AppInfo> {
  const safeAppId = validateShellInput(appId, "app ID");
  const output = runEcloudCommand(`compute app info ${safeAppId} --environment ${EIGENCOMPUTE_ENVIRONMENT}`);
  const parsed = parseDeployOutput(output);
  return {
    instanceIp: parsed.instanceIp ?? "",
    dockerDigest: parsed.dockerDigest ?? "",
    walletAddressEth: parsed.walletAddressEth ?? "",
    walletAddressSol: parsed.walletAddressSol ?? "",
  };
}
