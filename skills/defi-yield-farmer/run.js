import { x402Request, isError } from "./paytoll-client.js";
import { resolveToken, SUPPORTED_CHAIN_IDS } from "./token-registry.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const userInput = typeof raw.input === "string" ? JSON.parse(raw.input) : raw;

const skillMd = readFileSync(join(__dirname, "SKILL.md"), "utf-8");
const { data: frontmatter } = matter(skillMd);
const defaults = frontmatter.safety ?? {};

const config = {
  assets: userInput.config?.assets ?? defaults.allowed_assets ?? ["USDC", "USDT", "DAI", "WETH", "WBTC"],
  chainIds: userInput.config?.chainIds ?? defaults.allowed_chains ?? SUPPORTED_CHAIN_IDS,
  minImprovementBps: userInput.config?.minImprovementBps ?? defaults.min_improvement_bps ?? 50,
  maxPositionUsd: userInput.config?.maxPositionUsd ?? defaults.max_position_usd ?? 10000,
  minHealthFactor: userInput.config?.minHealthFactor ?? defaults.min_health_factor ?? 1.5,
  scanIntervalHours: userInput.config?.scanIntervalHours ?? defaults.scan_interval_hours ?? 4,
};
const walletAddress = userInput.walletAddress;

if (!walletAddress) {
  console.error(JSON.stringify({ status: "error", message: "walletAddress is required" }));
  process.exit(1);
}

const API = "https://api.paytoll.io/v1";

async function api(path, body) {
  const result = await x402Request(`${API}${path}`, "POST", body);
  if (isError(result)) throw new Error(`PayToll ${path}: ${result.message}`);
  return result.body;
}

async function scanBestYields() {
  const opportunities = [];
  for (const asset of config.assets) {
    try {
      const data = await api("/aave/best-yield", {
        asset,
        chainIds: config.chainIds,
      });
      if (data?.found) {
        opportunities.push({
          asset,
          chainId: data.chainId,
          apy: parseFloat(data.apy),
          tokenAddress: data.tokenAddress,
          liquidity: data.totalLiquidity,
        });
      }
    } catch (err) {
      console.error(`[scan] Failed to get yield for ${asset}: ${err.message}`);
    }
  }
  return opportunities;
}

async function getCurrentPositions() {
  try {
    const data = await api("/aave/user-positions", {
      userAddress: walletAddress,
      chainIds: config.chainIds,
    });
    return data?.positions ?? [];
  } catch {
    return [];
  }
}

async function checkHealthFactor(chainId) {
  try {
    const data = await api("/aave/health-factor", {
      userAddress: walletAddress,
      chainId,
    });
    return data?.healthFactor ? parseFloat(data.healthFactor) : null;
  } catch {
    return null;
  }
}

async function buildWithdrawTx(position) {
  return api("/aave/withdraw", {
    userAddress: walletAddress,
    tokenAddress: position.tokenAddress,
    amount: position.balance,
    chainId: position.chainId,
    max: true,
  });
}

async function buildSwapTx(fromChainId, toChainId, tokenSymbol, amount) {
  const fromToken = resolveToken(fromChainId, tokenSymbol);
  const toToken = resolveToken(toChainId, tokenSymbol);
  return api("/swap/build", {
    userAddress: walletAddress,
    fromChain: fromChainId,
    toChain: toChainId,
    fromToken,
    toToken,
    amount,
  });
}

async function buildSupplyTx(tokenAddress, amount, chainId) {
  return api("/aave/supply", {
    userAddress: walletAddress,
    tokenAddress,
    amount,
    chainId,
  });
}

function toExecutable(apiResponse) {
  if (!apiResponse) return null;
  if (apiResponse.type === "ready" || apiResponse.type === "approval_required" || apiResponse.type === "insufficient_balance") {
    return apiResponse;
  }
  if (apiResponse.transaction) {
    return { type: "ready", transaction: apiResponse.transaction };
  }
  if (apiResponse.tx) {
    return { type: "ready", transaction: apiResponse.tx };
  }
  return null;
}

function findBestForAsset(opportunities, asset) {
  return opportunities
    .filter((o) => o.asset.toUpperCase() === asset.toUpperCase())
    .sort((a, b) => b.apy - a.apy)[0] ?? null;
}

async function run() {
  const [opportunities, positions] = await Promise.all([
    scanBestYields(),
    getCurrentPositions(),
  ]);

  if (opportunities.length === 0) {
    console.log(JSON.stringify({
      status: "no_data",
      message: "Could not fetch yield data for any asset",
      nextScanIn: `${config.scanIntervalHours}h`,
    }));
    return;
  }

  if (positions.length === 0) {
    const best = opportunities.sort((a, b) => b.apy - a.apy)[0];
    const transactions = [];
    try {
      const supplyData = await buildSupplyTx(
        best.tokenAddress,
        "0",
        best.chainId
      );
      const executable = toExecutable(supplyData);
      if (executable) {
        transactions.push({
          step: "supply",
          description: `Supply ${best.asset} to Aave on chain ${best.chainId} at ${best.apy.toFixed(2)}% APY`,
          ...executable,
        });
      }
    } catch { /* tx build is best-effort for new positions */ }

    console.log(JSON.stringify({
      status: "new_deposit_recommended",
      message: `No existing positions. Best yield: ${best.apy.toFixed(2)}% APY for ${best.asset} on chain ${best.chainId}`,
      bestOpportunity: best,
      transactions,
      nextScanIn: `${config.scanIntervalHours}h`,
    }));
    return;
  }

  let bestRebalance = null;

  for (const pos of positions) {
    if (pos.type !== "supply") continue;

    const best = findBestForAsset(opportunities, pos.asset);
    if (!best) continue;

    const currentApy = parseFloat(pos.apy ?? "0");
    const improvementBps = Math.round((best.apy - currentApy) * 100);

    if (improvementBps < config.minImprovementBps) continue;
    if (best.chainId === pos.chainId) continue;

    if (!bestRebalance || improvementBps > bestRebalance.improvementBps) {
      bestRebalance = {
        position: pos,
        target: best,
        improvementBps,
        currentApy,
      };
    }
  }

  if (!bestRebalance) {
    const topCurrent = positions.find((p) => p.type === "supply");
    console.log(JSON.stringify({
      status: "holding",
      reason: `Current positions are within ${config.minImprovementBps}bps of best available yields`,
      currentPosition: topCurrent ?? null,
      bestAvailable: opportunities.sort((a, b) => b.apy - a.apy)[0],
      nextScanIn: `${config.scanIntervalHours}h`,
    }));
    return;
  }

  const { position: pos, target } = bestRebalance;

  const hasBorrows = positions.some(
    (p) => p.type === "borrow" && p.chainId === pos.chainId
  );
  let healthFactor = null;
  if (hasBorrows) {
    healthFactor = await checkHealthFactor(pos.chainId);
    if (healthFactor !== null && healthFactor < config.minHealthFactor) {
      console.log(JSON.stringify({
        status: "blocked",
        reason: `Health factor ${healthFactor.toFixed(2)} is below minimum ${config.minHealthFactor}. Cannot safely withdraw.`,
        currentPosition: pos,
        bestOpportunity: target,
        nextScanIn: `${config.scanIntervalHours}h`,
      }));
      return;
    }
  }

  const transactions = [];

  try {
    const withdrawData = await buildWithdrawTx(pos);
    const executable = toExecutable(withdrawData);
    if (executable) {
      transactions.push({
        step: "withdraw",
        description: `Withdraw ${pos.balance} ${pos.asset} from Aave on chain ${pos.chainId}`,
        ...executable,
      });
    }
  } catch (err) {
    console.error(`[plan] Withdraw tx build failed: ${err.message}`);
  }

  if (pos.chainId !== target.chainId) {
    try {
      const swapData = await buildSwapTx(
        pos.chainId,
        target.chainId,
        pos.asset,
        pos.balance
      );
      const executable = toExecutable(swapData);
      if (executable) {
        transactions.push({
          step: "bridge",
          description: `Bridge ${pos.balance} ${pos.asset} from chain ${pos.chainId} to chain ${target.chainId}`,
          ...executable,
        });
      }
    } catch (err) {
      console.error(`[plan] Bridge tx build failed: ${err.message}`);
    }
  }

  try {
    const supplyData = await buildSupplyTx(
      target.tokenAddress,
      pos.balance,
      target.chainId
    );
    const executable = toExecutable(supplyData);
    if (executable) {
      transactions.push({
        step: "supply",
        description: `Supply ${pos.balance} ${pos.asset} to Aave on chain ${target.chainId}`,
        ...executable,
      });
    }
  } catch (err) {
    console.error(`[plan] Supply tx build failed: ${err.message}`);
  }

  console.log(JSON.stringify({
    status: "rebalance_recommended",
    currentPosition: {
      asset: pos.asset,
      chainId: pos.chainId,
      apy: bestRebalance.currentApy.toFixed(2),
      balance: pos.balance,
    },
    bestOpportunity: {
      asset: target.asset,
      chainId: target.chainId,
      apy: target.apy.toFixed(2),
    },
    improvementBps: bestRebalance.improvementBps,
    safetyChecks: {
      healthFactor,
      hasBorrows,
    },
    transactions,
    nextScanIn: `${config.scanIntervalHours}h`,
  }));
}

run().catch((err) => {
  console.error(JSON.stringify({
    status: "error",
    message: `Yield farmer failed: ${err.message}`,
  }));
  process.exit(1);
});
