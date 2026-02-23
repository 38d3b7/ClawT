import { SiweMessage } from "siwe";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_SECRET = process.env.TOKEN_SECRET ?? randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export async function verifySiwe(
  message: string,
  signature: string
): Promise<string> {
  const siweMessage = new SiweMessage(message);
  const { data } = await siweMessage.verify({ signature });
  return data.address.toLowerCase();
}

export function createSessionToken(address: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${address.toLowerCase()}:${expiresAt}`;
  const hmac = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

export function verifySessionToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const providedHmac = decoded.slice(lastColon + 1);
    const expectedHmac = createHmac("sha256", TOKEN_SECRET)
      .update(payload)
      .digest("hex");

    if (providedHmac.length !== expectedHmac.length) return null;
    if (!timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac)))
      return null;

    const sepIdx = payload.indexOf(":");
    const address = payload.slice(0, sepIdx);
    const expiresAt = parseInt(payload.slice(sepIdx + 1), 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;
    return address;
  } catch {
    return null;
  }
}

export function getAuthAddress(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifySessionToken(authHeader.slice(7));
}
