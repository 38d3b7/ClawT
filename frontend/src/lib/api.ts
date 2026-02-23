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
