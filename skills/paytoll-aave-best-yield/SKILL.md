---
name: paytoll-aave-best-yield
description: >
  Find the best Aave V3 supply APY across all chains for a given asset.
  Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Best Yield

Find the best Aave V3 supply APY across all chains via [[x402-payments]]. Use this before [[paytoll-aave-supply]] to optimize yield.

Compare with [[paytoll-aave-markets]] for detailed market data. If the best yield is on a different chain, use [[dex-trading]] skills to move assets.

See [[aave-lending]] for the full yield optimization strategy.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| asset | string | Yes | Asset symbol (e.g., USDC, ETH, WBTC, DAI) |
| chainIds | array | No | Specific chain IDs to query |
| minLiquidity | number | No | Minimum available liquidity in USD |

## Example Input

```json
{
  "asset": "USDC"
}
```
