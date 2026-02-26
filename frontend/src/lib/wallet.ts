import {
  createWalletClient,
  createPublicClient,
  custom,
  getAddress,
  erc20Abi,
  type WalletClient,
  type PublicClient,
} from "viem";
import {
  SKILL_EIP712_DOMAIN,
  SKILL_EIP712_TYPES,
  buildSkillMessage,
  buildSignatureJson,
  type SkillSignature,
} from "./skill-signing";
import {
  EIGEN_CHAIN,
  EIGEN_CHAIN_HEX,
  EIGEN_CHAIN_NAME,
  EIGEN_CHAIN_RPC,
  EIGEN_CHAIN_EXPLORER,
  MARKETPLACE_CHAIN,
  MARKETPLACE_CHAIN_HEX,
  MARKETPLACE_CHAIN_NAME,
  MARKETPLACE_CHAIN_RPC,
  MARKETPLACE_CHAIN_EXPLORER,
  USDC_ADDRESS,
} from "./network-config";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function disconnectWallet() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Not all wallets support wallet_revokePermissions — safe to ignore
  }
}

async function resolveWalletClients() {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.[0]) throw new Error("No accounts returned");
  const address = getAddress(accounts[0]);

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: EIGEN_CHAIN_HEX }],
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: EIGEN_CHAIN_HEX,
            chainName: EIGEN_CHAIN_NAME,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [EIGEN_CHAIN_RPC],
            blockExplorerUrls: [EIGEN_CHAIN_EXPLORER],
          },
        ],
      });
    } else {
      throw new Error(`Please switch to ${EIGEN_CHAIN_NAME} to continue`);
    }
  }

  const walletClient = createWalletClient({
    account: address,
    chain: EIGEN_CHAIN,
    transport: custom(window.ethereum),
  });
  const publicClient = createPublicClient({
    chain: EIGEN_CHAIN,
    transport: custom(window.ethereum),
  });

  return { address, walletClient, publicClient };
}

export async function connectWallet() {
  await disconnectWallet();
  return resolveWalletClients();
}

export async function ensureWalletClient() {
  return resolveWalletClients();
}

export async function signSiweMessage(address: `0x${string}`, walletClient: ReturnType<typeof createWalletClient>) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const nonce = await fetch("/api/auth/nonce").then((r) => r.json()).then((d) => d.nonce as string);

  const siwe = sdk.createSiweMessage({
    address,
    chainId: EIGEN_CHAIN.id,
    domain: window.location.host,
    uri: window.location.origin,
    statement: "Sign in to CLAWT",
    nonce,
  });

  const signature = await walletClient.signMessage({
    account: address,
    message: siwe.message,
  });

  return { message: siwe.message, signature };
}

export async function signBillingAuth(
  address: `0x${string}`,
  walletClient: ReturnType<typeof createWalletClient>,
  product = "compute"
): Promise<{ signature: string; expiry: string; address: string }> {
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 5 * 60);

  const signature = await walletClient.signTypedData({
    account: address,
    domain: { name: "EigenCloud Billing API", version: "1" },
    types: {
      BillingAuth: [
        { name: "product", type: "string" },
        { name: "expiry", type: "uint256" },
      ],
    },
    primaryType: "BillingAuth" as const,
    message: { product, expiry },
  });

  return { signature, expiry: expiry.toString(), address };
}

export async function signGrantMessage(address: string) {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  const res = await fetch(`/api/auth/grant-message?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Failed to fetch grant message: ${res.status}`);
  const data = await res.json();
  const message = data.message as string;

  const walletClient = createWalletClient({
    account: address as `0x${string}`,
    chain: EIGEN_CHAIN,
    transport: custom(window.ethereum),
  });

  const signature = await walletClient.signMessage({
    account: address as `0x${string}`,
    message,
  });

  return { grantMessage: message, grantSignature: signature };
}

async function switchToMarketplaceChain() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MARKETPLACE_CHAIN_HEX }],
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: MARKETPLACE_CHAIN_HEX,
            chainName: MARKETPLACE_CHAIN_NAME,
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [MARKETPLACE_CHAIN_RPC],
            blockExplorerUrls: [MARKETPLACE_CHAIN_EXPLORER],
          },
        ],
      });
    } else {
      throw new Error(`Please switch to ${MARKETPLACE_CHAIN_NAME} to complete the purchase`);
    }
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeSkillContentHash(content: string): Promise<`0x${string}`> {
  const fileHash = await sha256Hex(content);
  const fileEntry = `sha256:${fileHash}`;
  const rootHash = await sha256Hex(fileEntry);
  return `0x${rootHash}` as `0x${string}`;
}

export async function signSkillSubmission(
  address: `0x${string}`,
  walletClient: ReturnType<typeof createWalletClient>,
  skillName: string,
  content: string
): Promise<SkillSignature> {
  const contentHash = await computeSkillContentHash(content);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = buildSkillMessage(skillName, contentHash, address, BigInt(timestamp));

  const signature = await walletClient.signTypedData({
    account: address,
    domain: SKILL_EIP712_DOMAIN,
    types: SKILL_EIP712_TYPES,
    primaryType: "SkillSubmission" as const,
    message,
  });

  return buildSignatureJson(skillName, address, signature, contentHash, timestamp);
}

export async function transferUSDC(
  fromAddress: `0x${string}`,
  to: `0x${string}`,
  amountMicroUsdc: bigint
): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  await switchToMarketplaceChain();

  const wc = createWalletClient({
    account: fromAddress,
    chain: MARKETPLACE_CHAIN,
    transport: custom(window.ethereum),
  });
  const pc = createPublicClient({
    chain: MARKETPLACE_CHAIN,
    transport: custom(window.ethereum),
  });

  const hash = await wc.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountMicroUsdc],
  });

  await pc.waitForTransactionReceipt({ hash });
  return hash;
}
