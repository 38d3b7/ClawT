---
name: defi-yield-farmer
description: >
  Autonomous Aave V3 yield optimizer. Scans markets across chains, finds the
  best supply yields, and builds a rebalance transaction plan including
  withdrawals, cross-chain swaps, and deposits. Powered by PayToll.
version: 1.0.0
author: clawt
requires_env: []
safety:
  min_improvement_bps: 50
  max_position_usd: 10000
  min_health_factor: 1.5
  scan_interval_hours: 4
  allowed_assets: [USDC, USDT, DAI, WETH, WBTC]
  allowed_chains: [1, 8453, 42161, 10, 137]
execution:
  - run: node run.js {{input}}
---

# DeFi Yield Farmer

Autonomous Aave V3 yield optimizer that scans markets every few hours and builds rebalance plans when a better opportunity exists. Uses [[paytoll-aave-best-yield]] to discover rates, [[paytoll-aave-user-positions]] to check current deposits, and [[paytoll-swap-build]] for cross-chain moves.

This is a **strategy skill** — it outputs a structured action plan with ready-to-sign transactions. The agent executes each transaction via `send_transaction`, then schedules the next scan with `schedule_task`.

## How It Works

1. **Scan** — Calls [[paytoll-aave-best-yield]] for each asset in `allowed_assets` across `allowed_chains` to find the highest supply APYs
2. **Check positions** — Calls [[paytoll-aave-user-positions]] with the agent's wallet to get current deposits
3. **Compare** — Computes the APY improvement in basis points. If below `min_improvement_bps`, holds
4. **Safety** — If the wallet has active borrows, calls [[paytoll-aave-health-factor]] and aborts if rebalancing would drop health below `min_health_factor`
5. **Plan** — Builds transaction steps:
   - [[paytoll-aave-withdraw]] to exit the current position
   - [[paytoll-swap-build]] to bridge/swap cross-chain (via Li.Fi)
   - [[paytoll-aave-supply]] to deposit on the better chain
6. **Output** — Returns a JSON action plan for the agent to execute

## Safety Rails

Declared in frontmatter and enforced by `run.js`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `min_improvement_bps` | 50 | Minimum APY improvement (basis points) to trigger rebalance |
| `max_position_usd` | 10000 | Maximum position size in USD |
| `min_health_factor` | 1.5 | Minimum Aave health factor to maintain |
| `scan_interval_hours` | 4 | Hours between automated scans |
| `allowed_assets` | USDC, USDT, DAI, WETH, WBTC | Assets to monitor |
| `allowed_chains` | 1, 8453, 42161, 10, 137 | Chain IDs to scan |

## Input

```json
{
  "walletAddress": "0x...",
  "config": {
    "assets": ["USDC"],
    "minImprovementBps": 100,
    "maxPositionUsd": 5000
  }
}
```

All config fields are optional — defaults come from the frontmatter `safety` block.

## Output

When a rebalance is recommended:

```json
{
  "status": "rebalance_recommended",
  "currentPosition": { "asset": "USDC", "chainId": 8453, "apy": "3.70", "balance": "1000" },
  "bestOpportunity": { "asset": "USDC", "chainId": 42161, "apy": "5.10" },
  "improvementBps": 140,
  "safetyChecks": { "healthFactor": null, "estimatedGasCostUsd": 0.85 },
  "transactions": [
    { "step": "withdraw", "description": "Withdraw 1000 USDC from Aave Base", "tx": {} },
    { "step": "bridge", "description": "Bridge USDC Base→Arbitrum", "tx": {} },
    { "step": "supply", "description": "Supply 1000 USDC to Aave Arbitrum", "tx": {} }
  ]
}
```

When holding: `{ "status": "holding", "reason": "...", "nextScanIn": "4h" }`

## Agent Usage

Ask the agent to start yield farming, for example:

> "Start yield farming with my USDC. Scan every 4 hours and rebalance if the APY improves by at least 0.5%."

The agent will:
1. Select this skill to scan markets
2. Execute each transaction in the plan via `send_transaction`
3. Call `schedule_task` to repeat the scan on the configured interval

## Related Skills

- [[paytoll-aave-markets]] — Overview of all Aave V3 markets
- [[paytoll-aave-best-borrow]] — Find lowest borrow rates
- [[paytoll-aave-borrow]] — Build borrow transactions
- [[paytoll-aave-repay]] — Build repay transactions
- [[paytoll-crypto-price]] — Real-time asset prices
- [[paytoll-swap-quote]] — Get swap quotes before building
