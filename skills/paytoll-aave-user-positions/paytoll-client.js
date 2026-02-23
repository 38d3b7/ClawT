/**
 * PayToll Client Helper
 *
 * Makes x402 requests to PayToll API (api.paytoll.io) via the TEE bridge.
 * Uses fd3 for IPC, keeping stdout clean for skill output.
 *
 * Usage:
 *   import { x402Request, isError } from './paytoll-client.js';
 *
 *   const result = await x402Request(
 *     'https://api.paytoll.io/v1/crypto/price',
 *     'POST',
 *     { symbol: 'ETH' }
 *   );
 *
 *   if (isError(result)) {
 *     console.error(result.message);
 *   } else {
 *     console.log(result.body);
 *   }
 */

import { createReadStream, createWriteStream } from "fs";
import { createInterface } from "readline";

let fd3Out = null;
let fd3In = null;
let rl = null;
let fd3Available = false;

try {
  fd3Out = createWriteStream(null, { fd: 3 });
  fd3In = createReadStream(null, { fd: 3 });
  rl = createInterface({ input: fd3In });
  fd3Available = true;

  fd3Out.on("error", () => {
    fd3Available = false;
  });
  fd3In.on("error", () => {
    fd3Available = false;
  });
} catch {
  fd3Available = false;
}

let requestId = 0;
const pendingRequests = new Map();

if (rl) {
  rl.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      const id = response.id;
      if (id !== undefined && pendingRequests.has(id)) {
        const { resolve } = pendingRequests.get(id);
        pendingRequests.delete(id);
        resolve(response);
      }
    } catch (err) {
      console.error("[paytoll-client] Failed to parse IPC response:", err.message);
    }
  });

  rl.on("close", () => {
    for (const [id, { reject }] of pendingRequests) {
      reject(new Error("IPC channel closed"));
      pendingRequests.delete(id);
    }
  });
}

/**
 * Make an x402 request via the TEE bridge.
 *
 * @param {string} url - PayToll API URL (e.g., https://api.paytoll.io/v1/crypto/price)
 * @param {string} [method='POST'] - HTTP method
 * @param {object} [body=null] - Request body
 * @param {object} [options={}] - Additional options (headers, timeout)
 * @returns {Promise<object>} Response or error object
 */
export async function x402Request(url, method = "POST", body = null, options = {}) {
  if (!fd3Available || !fd3Out) {
    return {
      error: "IPC_UNAVAILABLE",
      message: "fd3 IPC channel not available — running outside TEE executor context",
      recoverable: false,
      suggestedAction: "Run this script via the CLAWT executor",
    };
  }

  const id = ++requestId;
  const timeout = options.timeout || 30000;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });

    const timer = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve({
          error: "TIMEOUT",
          message: `TEE bridge did not respond within ${timeout}ms`,
          recoverable: true,
          suggestedAction: "Retry the request",
        });
      }
    }, timeout);

    const originalResolve = resolve;
    resolve = (value) => {
      clearTimeout(timer);
      originalResolve(value);
    };

    const request = {
      action: "x402_request",
      id,
      url,
      method,
      body,
    };

    if (options.headers) {
      request.headers = options.headers;
    }

    try {
      fd3Out.write(JSON.stringify(request) + "\n");
    } catch (err) {
      pendingRequests.delete(id);
      clearTimeout(timer);
      resolve({
        error: "IPC_ERROR",
        message: `Failed to write to fd3: ${err.message}`,
        recoverable: false,
      });
    }
  });
}

/**
 * Check if a response is an error.
 */
export function isError(response) {
  return response && typeof response.error === "string";
}

/**
 * Check if an error is recoverable.
 */
export function isRecoverable(response) {
  return response && response.recoverable === true;
}
