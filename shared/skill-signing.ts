import { verifyTypedData, type Hex, type Address } from "viem";

export const SKILL_EIP712_DOMAIN = {
  name: "CLAWTSkill",
  version: "1",
  chainId: 0,
} as const;

export const SKILL_EIP712_TYPES = {
  SkillSubmission: [
    { name: "skillName", type: "string" },
    { name: "contentHash", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

export interface SkillSignature {
  version: "1";
  skillName: string;
  author: string;
  signature: string;
  contentHash: string;
  timestamp: number;
  eip712Domain: { name: string; version: string; chainId: number };
}

export function buildSkillMessage(
  skillName: string,
  contentHash: Hex,
  author: Address,
  timestamp: bigint
) {
  return { skillName, contentHash, author, timestamp };
}

export async function verifySkillSignature(sig: SkillSignature): Promise<boolean> {
  try {
    return await verifyTypedData({
      address: sig.author as Address,
      domain: SKILL_EIP712_DOMAIN,
      types: SKILL_EIP712_TYPES,
      primaryType: "SkillSubmission",
      message: buildSkillMessage(
        sig.skillName,
        sig.contentHash as Hex,
        sig.author as Address,
        BigInt(sig.timestamp)
      ),
      signature: sig.signature as Hex,
    });
  } catch {
    return false;
  }
}

export function buildSignatureJson(
  skillName: string,
  author: Address,
  signature: Hex,
  contentHash: Hex,
  timestamp: number
): SkillSignature {
  return {
    version: "1",
    skillName,
    author,
    signature,
    contentHash,
    timestamp,
    eip712Domain: { ...SKILL_EIP712_DOMAIN },
  };
}
