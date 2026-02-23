import { mnemonicToAccount } from "viem/accounts";

const mnemonic = process.env.MNEMONIC;

if (!mnemonic) {
  console.warn("MNEMONIC not set — running in dev mode without TEE wallet");
}

export const account = mnemonic ? mnemonicToAccount(mnemonic) : null;

export function getAgentAddress(): string {
  return account?.address ?? "0x0000000000000000000000000000000000000000";
}

export async function signMessage(message: string): Promise<string> {
  if (!account) {
    return "0x" + "0".repeat(130);
  }
  return account.signMessage({ message });
}
