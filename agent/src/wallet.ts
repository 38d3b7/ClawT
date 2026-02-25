import { mnemonicToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  parseUnits,
  parseEther,
  erc20Abi,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hex,
} from "viem";
import { sepolia, baseSepolia, base, mainnet, arbitrum, optimism, polygon } from "viem/chains";

const mnemonic = process.env.MNEMONIC;

if (!mnemonic) {
  console.warn("MNEMONIC not set — running in dev mode without TEE wallet");
}

export const account = mnemonic ? mnemonicToAccount(mnemonic) : null;

const RPC_SEPOLIA = process.env.RPC_URL_SEPOLIA ?? "https://rpc.sepolia.org";
const RPC_BASE_SEPOLIA = process.env.RPC_URL_BASE_SEPOLIA ?? "https://sepolia.base.org";
const RPC_BASE = process.env.RPC_URL_BASE ?? "https://mainnet.base.org";
const RPC_MAINNET = process.env.RPC_URL_MAINNET ?? "https://eth.llamarpc.com";
const RPC_ARBITRUM = process.env.RPC_URL_ARBITRUM ?? "https://arb1.arbitrum.io/rpc";
const RPC_OPTIMISM = process.env.RPC_URL_OPTIMISM ?? "https://mainnet.optimism.io";
const RPC_POLYGON = process.env.RPC_URL_POLYGON ?? "https://polygon-rpc.com";

export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_DECIMALS = 6;

type SupportedChain =
  | "sepolia"
  | "base-sepolia"
  | "base"
  | "mainnet"
  | "arbitrum"
  | "optimism"
  | "polygon";

const chains: Record<SupportedChain, { chain: Chain; rpc: string }> = {
  sepolia: { chain: sepolia, rpc: RPC_SEPOLIA },
  "base-sepolia": { chain: baseSepolia, rpc: RPC_BASE_SEPOLIA },
  base: { chain: base, rpc: RPC_BASE },
  mainnet: { chain: mainnet, rpc: RPC_MAINNET },
  arbitrum: { chain: arbitrum, rpc: RPC_ARBITRUM },
  optimism: { chain: optimism, rpc: RPC_OPTIMISM },
  polygon: { chain: polygon, rpc: RPC_POLYGON },
};

const CHAIN_ID_TO_NETWORK: Record<number, SupportedChain> = {
  1: "mainnet",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  11155111: "sepolia",
  84532: "base-sepolia",
};

export function chainIdToNetwork(chainId: number): SupportedChain {
  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (!network) throw new Error(`Unsupported chain ID: ${chainId}`);
  return network;
}

function buildPublicClient(network: SupportedChain): PublicClient {
  const { chain, rpc } = chains[network];
  return createPublicClient({ chain, transport: http(rpc) }) as PublicClient;
}

function buildWalletClient(network: SupportedChain): WalletClient | null {
  if (!account) return null;
  const { chain: viemChain, rpc } = chains[network];
  return createWalletClient({ account, chain: viemChain, transport: http(rpc) });
}

function getChain(network: SupportedChain): Chain {
  return chains[network].chain;
}

const publicClientCache = new Map<SupportedChain, PublicClient>();
const walletClientCache = new Map<SupportedChain, WalletClient>();

export function getPublicClient(network: SupportedChain): PublicClient {
  let pc = publicClientCache.get(network);
  if (!pc) {
    pc = buildPublicClient(network);
    publicClientCache.set(network, pc);
  }
  return pc;
}

function getWalletClient(network: SupportedChain): WalletClient {
  if (!account) throw new Error("No wallet available");
  let wc = walletClientCache.get(network);
  if (!wc) {
    wc = buildWalletClient(network)!;
    walletClientCache.set(network, wc);
  }
  return wc;
}

export const publicClients: Record<string, PublicClient> = new Proxy(
  {} as Record<string, PublicClient>,
  { get: (_t, prop: string) => getPublicClient(prop as SupportedChain) }
);

export const walletClients: Record<string, WalletClient | null> = new Proxy(
  {} as Record<string, WalletClient | null>,
  { get: (_t, prop: string) => (account ? getWalletClient(prop as SupportedChain) : null) }
);

export function getAgentAddress(): string {
  return account?.address ?? "0x0000000000000000000000000000000000000000";
}

export async function signMessage(message: string): Promise<string> {
  if (!account) {
    return "0x" + "0".repeat(130);
  }
  return account.signMessage({ message });
}

export async function getBalance(
  network: SupportedChain = "base-sepolia"
): Promise<{ eth: string; wei: bigint }> {
  const pc = getPublicClient(network);
  const address = account?.address;
  if (!address) return { eth: "0", wei: 0n };
  const wei = await pc.getBalance({ address });
  return { eth: formatEther(wei), wei };
}

export async function getERC20Balance(
  tokenAddress: Hex,
  network: SupportedChain = "base-sepolia",
  decimals = 18
): Promise<{ formatted: string; raw: bigint }> {
  const pc = getPublicClient(network);
  const address = account?.address;
  if (!address) return { formatted: "0", raw: 0n };
  const raw = (await pc.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
  return { formatted: formatUnits(raw, decimals), raw };
}

export async function getUSDCBalance(
  network: SupportedChain = "base-sepolia"
): Promise<{ formatted: string; raw: bigint }> {
  return getERC20Balance(USDC_BASE_SEPOLIA, network, USDC_DECIMALS);
}

export async function transferETH(
  to: Hex,
  amountEth: string,
  network: SupportedChain = "base-sepolia"
): Promise<Hex> {
  const wc = getWalletClient(network);
  const hash = await wc.sendTransaction({
    account: account!,
    chain: getChain(network),
    to,
    value: parseEther(amountEth),
  });
  return hash;
}

export async function transferERC20(
  tokenAddress: Hex,
  to: Hex,
  amount: string,
  network: SupportedChain = "base-sepolia",
  decimals = 18
): Promise<Hex> {
  const wc = getWalletClient(network);
  const hash = await wc.writeContract({
    account: account!,
    chain: getChain(network),
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(amount, decimals)],
  });
  return hash;
}

export async function transferUSDC(
  to: Hex,
  amountUsdc: string,
  network: SupportedChain = "base-sepolia"
): Promise<Hex> {
  return transferERC20(USDC_BASE_SEPOLIA, to, amountUsdc, network, USDC_DECIMALS);
}

export async function writeContract(
  address: Hex,
  abi: readonly unknown[],
  functionName: string,
  args: unknown[],
  network: SupportedChain = "base-sepolia"
): Promise<Hex> {
  const wc = getWalletClient(network);
  const hash = await wc.writeContract({
    account: account!,
    chain: getChain(network),
    address,
    abi,
    functionName,
    args,
  } as Parameters<typeof wc.writeContract>[0]);
  return hash;
}

export interface TxReceipt {
  hash: Hex;
  network: SupportedChain;
  status: "success" | "reverted";
  blockNumber: string;
  gasUsed: string;
}

export async function sendRawTransaction(
  to: Hex,
  data: Hex,
  value: bigint,
  network: SupportedChain = "base-sepolia"
): Promise<TxReceipt> {
  const wc = getWalletClient(network);
  const pc = getPublicClient(network);
  const hash = await wc.sendTransaction({
    account: account!,
    chain: getChain(network),
    to,
    data,
    value,
  });
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return {
    hash,
    network,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
  };
}

export type { SupportedChain };
