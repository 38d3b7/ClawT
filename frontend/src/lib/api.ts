export interface AgentInfo {
  name: string;
  status: string;
  appId: string | null;
  walletAddressEth: string | null;
  instanceIp: string | null;
  createdAt: string;
}

export interface TaskResult {
  result: string;
  skillsUsed: string[];
  agentSignature: string;
  agentAddress: string;
}

export interface EvolutionLogEntry {
  timestamp: number;
  action: string;
  path?: string;
  summary: string;
  signature: string;
  riskScore: number;
}

export interface EvolutionData {
  stats: {
    totalModifications: number;
    evolvedTools: number;
    evolvedSkills: number;
    packagesInstalled: number;
    totalRisk: number;
  };
  recentLog: EvolutionLogEntry[];
}

export interface HealthData {
  status: string;
  uptime: { ms: number; formatted: string };
  grant: { hasGrant: boolean; tokenCount: number };
  memory: { count: number; categories: Record<string, number> };
  scheduler: { heartbeats: number; tasks: number };
  evolution: {
    totalModifications: number;
    evolvedTools: number;
    evolvedSkills: number;
    packagesInstalled: number;
    totalRisk: number;
  };
  lastError: string | null;
}

export interface SkillInfo {
  id: string;
  description: string;
  version: string;
  author: string;
}

function getHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function verifyAuth(
  message: string,
  signature: string
): Promise<{ address: string; token: string; hasAgent: boolean }> {
  const res = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  if (!res.ok) throw new Error("Auth verification failed");
  return res.json();
}

export async function getAgentInfo(token: string): Promise<AgentInfo | null> {
  const res = await fetch("/api/agents/info", { headers: getHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to get agent info");
  return res.json();
}

export async function registerAgent(
  token: string,
  data: {
    name: string;
    appId: string;
    walletAddressEth?: string;
    instanceIp?: string;
  }
): Promise<{ agentId: number; appId: string }> {
  const res = await fetch("/api/agents/register", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Registration failed");
  }
  return res.json();
}

export async function updateAgentStatus(
  token: string,
  fields: { status?: string; instanceIp?: string; walletAddressEth?: string }
): Promise<void> {
  const res = await fetch("/api/agents/update", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Failed to update agent");
}

export async function submitTask(
  token: string,
  task: string,
  sessionId?: string
): Promise<TaskResult> {
  const res = await fetch("/api/agents/task", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ task, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Task failed");
  }
  return res.json();
}

export async function getBillingStatus(
  token: string,
  billingAuth: { signature: string; expiry: string; address: string }
): Promise<{ active: boolean; portalUrl?: string; error?: string }> {
  const res = await fetch("/api/eigen/billing", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({
      billingSignature: billingAuth.signature,
      billingExpiry: billingAuth.expiry,
      billingAddress: billingAuth.address,
      returnUrl: window.location.href,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { active: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return {
    active: data.active === true || data.subscriptionStatus === "active",
    portalUrl: data.portalUrl,
    error: data.active ? undefined : data.debugInfo,
  };
}

export async function subscribeToBilling(
  token: string,
  billingAuth: { signature: string; expiry: string; address: string }
): Promise<{
  checkoutUrl?: string;
  alreadyActive?: boolean;
  portalUrl?: string;
  subscriptionStatus?: string;
}> {
  const res = await fetch("/api/eigen/billing", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({
      billingSignature: billingAuth.signature,
      billingExpiry: billingAuth.expiry,
      billingAddress: billingAuth.address,
      action: "subscribe",
      returnUrl: `${window.location.origin}${window.location.pathname}?billing=success`,
    }),
  });
  if (!res.ok) throw new Error("Billing request failed");
  return res.json();
}

export async function getGrantStatus(
  address: string
): Promise<{ hasGrant: boolean; tokenCount: number }> {
  const res = await fetch(`/api/auth/grant?address=${encodeURIComponent(address)}`);
  if (!res.ok) return { hasGrant: false, tokenCount: 0 };
  return res.json();
}

export async function getAppInfo(
  token: string,
  siweMessage: string,
  siweSignature: string,
  appIds: string[]
): Promise<{ apps: Array<{ address: string; status: string; ip: string }> }> {
  const res = await fetch("/api/eigen/app-info", {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ siweMessage, siweSignature, appIds }),
  });
  if (!res.ok) throw new Error("Failed to get app info");
  return res.json();
}

export async function getAgentHealth(token: string): Promise<HealthData | null> {
  try {
    const res = await fetch("/api/agents/health", { headers: getHeaders(token) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getAgentEvolution(token: string): Promise<EvolutionData | null> {
  try {
    const res = await fetch("/api/agents/evolution", { headers: getHeaders(token) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getAgentSkills(token: string): Promise<SkillInfo[]> {
  try {
    const res = await fetch("/api/agents/skills", { headers: getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.skills ?? [];
  } catch {
    return [];
  }
}

export async function getAgentEnv(token: string): Promise<Record<string, string>> {
  const res = await fetch("/api/agents/env", { headers: getHeaders(token) });
  if (!res.ok) throw new Error("Failed to fetch env vars");
  const data = await res.json();
  return data.envVars;
}

// ── Marketplace ──

export interface ListingPreview {
  id: string;
  sellerAddress: string;
  type: "skill" | "soul";
  title: string;
  description: string;
  price: number;
  status: string;
  createdAt: string | null;
}

export interface ListingDetail extends ListingPreview {
  priceFormatted: string;
  preview: string;
  isOwner: boolean;
  purchased: boolean;
  content: string | null;
}

export interface PurchaseItem {
  purchaseId: string;
  txHash: string;
  purchasedAt: string | null;
  listing: {
    id: string;
    type: string;
    title: string;
    description: string;
    price: number;
    priceFormatted: string;
    sellerAddress: string;
    content: string;
  };
}

export async function getMarketplaceListings(
  type?: "skill" | "soul"
): Promise<ListingPreview[]> {
  const url = type
    ? `/api/marketplace/listings?type=${type}`
    : "/api/marketplace/listings";
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.listings ?? [];
}

export async function getListingDetail(
  id: string,
  token?: string
): Promise<ListingDetail | null> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/marketplace/listings/${id}`, { headers });
  if (!res.ok) return null;
  return res.json();
}

export async function getMyPurchases(
  token: string,
  type?: "skill" | "soul"
): Promise<PurchaseItem[]> {
  const url = type
    ? `/api/marketplace/purchases?type=${type}`
    : "/api/marketplace/purchases";
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.purchases ?? [];
}
