import { createWalletClient, createPublicClient, custom, getAddress } from "viem";
import { sepolia } from "viem/chains";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.[0]) throw new Error("No accounts returned");
  const address = getAddress(accounts[0]);

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw new Error("Please switch to the Sepolia network to continue");
    }
  }

  const walletClient = createWalletClient({
    account: address,
    chain: sepolia,
    transport: custom(window.ethereum),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  return { address, walletClient, publicClient };
}

export async function signSiweMessage(address: `0x${string}`, walletClient: ReturnType<typeof createWalletClient>) {
  const sdk = await import("@layr-labs/ecloud-sdk/browser");
  const nonce = await fetch("/api/auth/nonce").then((r) => r.json()).then((d) => d.nonce as string);

  const siwe = sdk.createSiweMessage({
    address,
    chainId: sepolia.id,
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
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  const signature = await walletClient.signMessage({
    account: address as `0x${string}`,
    message,
  });

  return { grantMessage: message, grantSignature: signature };
}
