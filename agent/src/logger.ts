import { signMessage, getAgentAddress } from "./wallet.js";

const MAX_LOG_ENTRIES = 1000;

export interface LogEntry {
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  agentAddress: string;
  signature: string;
}

const log: LogEntry[] = [];

export async function addLogEntry(
  type: string,
  data: Record<string, unknown>
): Promise<LogEntry> {
  const timestamp = new Date().toISOString();
  const agentAddress = getAgentAddress();
  const payload = JSON.stringify({ timestamp, type, data, agentAddress });
  const signature = await signMessage(payload);
  const entry: LogEntry = { timestamp, type, data, agentAddress, signature };
  log.push(entry);
  if (log.length > MAX_LOG_ENTRIES) {
    log.splice(0, log.length - MAX_LOG_ENTRIES);
  }
  return entry;
}

export function getHistory(): LogEntry[] {
  return [...log];
}
