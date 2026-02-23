---
name: paytoll-aave-withdraw
description: >
  Build an Aave V3 withdraw transaction. Returns ready-to-sign transaction
  data. Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Withdraw

Build Aave V3 withdraw transactions via [[x402-payments]]. Remove assets you supplied with [[paytoll-aave-supply]].

If you have active borrows, check [[paytoll-aave-health-factor]] before withdrawing — removing collateral lowers your health factor. Use [[paytoll-aave-repay]] first if needed.

See [[aave-lending]] for the full lending lifecycle.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAddress | string | Yes | Wallet address that will sign |
| tokenAddress | string | Yes | ERC20 token contract to withdraw |
| amount | string | No | Amount to withdraw (required unless max is true) |
| max | boolean | No | If true, withdraw entire supply position |
| chainId | integer | Yes | Chain ID |
| marketAddress | string | No | Aave pool address |

## Example Input

```json
{
  "userAddress": "0x...",
  "tokenAddress": "0x...",
  "max": true,
  "chainId": 8453
}
```
