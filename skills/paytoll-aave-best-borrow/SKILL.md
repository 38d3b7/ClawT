---
name: paytoll-aave-best-borrow
description: >
  Find the lowest Aave V3 borrow APR across all chains for a given asset.
  Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Best Borrow

Find the lowest Aave V3 borrow APR across all chains via [[x402-payments]]. Use this before [[paytoll-aave-borrow]] to minimize interest costs.

Compare with [[paytoll-aave-markets]] for detailed market data. If the best rate is on a different chain, use [[dex-trading]] skills to move assets.

See [[aave-lending]] for borrowing strategy and [[paytoll-aave-health-factor]] for risk management.

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
