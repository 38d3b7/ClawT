---
name: paytoll-aave-user-positions
description: >
  Get all Aave V3 positions for a wallet address across chains.
  Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave User Positions

Get all Aave V3 positions for a wallet address across chains via [[x402-payments]]. Shows supplies, borrows, and collateral status.

Combine with [[paytoll-aave-health-factor]] for detailed risk analysis. Use [[paytoll-aave-withdraw]] or [[paytoll-aave-repay]] to manage positions.

See [[aave-lending]] for position management strategy.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAddress | string | Yes | Wallet address to check |
| chainIds | array | No | Specific chain IDs to query |

## Example Input

```json
{
  "userAddress": "0x..."
}
```
