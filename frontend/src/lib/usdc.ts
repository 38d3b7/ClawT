import { createPublicClient, http, decodeEventLog, erc20Abi } from "viem";
import {
  MARKETPLACE_CHAIN,
  MARKETPLACE_CHAIN_RPC,
  USDC_ADDRESS,
} from "./network-config";

const client = createPublicClient({
  chain: MARKETPLACE_CHAIN,
  transport: http(MARKETPLACE_CHAIN_RPC),
});

export async function verifyUSDCTransfer(
  txHash: `0x${string}`,
  expectedTo: string,
  expectedMinAmount: bigint
): Promise<{ verified: boolean; from: string; to: string; amount: bigint }> {
  const receipt = await client.getTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    return { verified: false, from: "", to: "", amount: BigInt(0) };
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Transfer") continue;

      const { from, to, value } = decoded.args;
      if (
        to.toLowerCase() === expectedTo.toLowerCase() &&
        value >= expectedMinAmount
      ) {
        return { verified: true, from, to, amount: value };
      }
    } catch {
      continue;
    }
  }

  return { verified: false, from: "", to: "", amount: BigInt(0) };
}

export function formatUSDC(microUsdc: number): string {
  return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}
