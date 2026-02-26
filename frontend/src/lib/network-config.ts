import { sepolia, mainnet, base, baseSepolia } from "viem/chains";
import type { Chain } from "viem";

type EigenEnvironment = "sepolia" | "mainnet-alpha";

const ENV = (process.env.NEXT_PUBLIC_EIGEN_ENVIRONMENT?.trim() ?? "sepolia") as EigenEnvironment;
const IS_MAINNET = ENV === "mainnet-alpha";

export const EIGEN_ENVIRONMENT: EigenEnvironment = ENV;

export const EIGEN_CHAIN: Chain = IS_MAINNET ? mainnet : sepolia;

export const EIGEN_CHAIN_HEX = IS_MAINNET ? "0x1" : "0xaa36a7";

export const EIGEN_CHAIN_NAME = IS_MAINNET ? "Ethereum" : "Sepolia";

export const EIGEN_CHAIN_RPC = IS_MAINNET
  ? "https://ethereum-rpc.publicnode.com"
  : "https://rpc.sepolia.org";

export const EIGEN_CHAIN_EXPLORER = IS_MAINNET
  ? "https://etherscan.io"
  : "https://sepolia.etherscan.io";

export const KMS_BUILD: "dev" | "prod" = "prod";

export const COMPUTE_API_URL = IS_MAINNET
  ? "https://userapi-compute.eigencloud.xyz"
  : "https://userapi-compute-sepolia-prod.eigencloud.xyz";

export const MARKETPLACE_CHAIN: Chain = IS_MAINNET ? base : baseSepolia;

export const MARKETPLACE_CHAIN_HEX = IS_MAINNET ? "0x2105" : "0x14a34";

export const MARKETPLACE_CHAIN_NAME = IS_MAINNET ? "Base" : "Base Sepolia";

export const MARKETPLACE_CHAIN_RPC = IS_MAINNET
  ? "https://mainnet.base.org"
  : "https://sepolia.base.org";

export const MARKETPLACE_CHAIN_EXPLORER = IS_MAINNET
  ? "https://basescan.org"
  : "https://sepolia.basescan.org";

export const USDC_ADDRESS = IS_MAINNET
  ? ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const)
  : ("0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const);
