import { SiweMessage } from "siwe";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

const TOKEN_SECRET = process.env.TOKEN_SECRET ?? randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;

const nonceStore = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceStore) {
    if (now > expiresAt) nonceStore.delete(nonce);
  }
}, 60_000);

export function generateNonce(): string {
  const nonce = randomBytes(16).toString("hex");
  nonceStore.set(nonce, Date.now() + NONCE_TTL_MS);
  return nonce;
}

function validateNonce(nonce: string): boolean {
  const expiresAt = nonceStore.get(nonce);
  if (!expiresAt || Date.now() > expiresAt) {
    nonceStore.delete(nonce);
    return false;
  }
  nonceStore.delete(nonce);
  return true;
}

export async function verifySiwe(message: string, signature: string): Promise<string> {
  const siweMessage = new SiweMessage(message);
  if (!validateNonce(siweMessage.nonce)) {
    throw new Error("Invalid or expired nonce");
  }
  const { data } = await siweMessage.verify({ signature });
  return data.address.toLowerCase();
}

export function createSessionToken(address: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${address.toLowerCase()}:${expiresAt}`;
  const hmac = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

function verifySessionToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const providedHmac = decoded.slice(lastColon + 1);
    const expectedHmac = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");

    if (providedHmac.length !== expectedHmac.length) return null;
    if (!timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) return null;

    const sepIdx = payload.indexOf(":");
    const address = payload.slice(0, sepIdx);
    const expiresAt = parseInt(payload.slice(sepIdx + 1), 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
    return address;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  const address = verifySessionToken(token);
  if (!address) {
    res.status(401).json({ error: "Invalid or expired auth token" });
    return;
  }
  (req as Request & { userAddress: string }).userAddress = address;
  next();
}

export function getUserAddress(req: Request): string {
  return (req as Request & { userAddress: string }).userAddress;
}
