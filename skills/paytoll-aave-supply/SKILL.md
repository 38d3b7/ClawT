---
name: paytoll-aave-supply
description: >
  Build an Aave V3 supply (deposit) transaction. Returns ready-to-sign
  transaction data. Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Supply

Build Aave V3 supply (deposit) transactions via [[x402-payments]]. This is the entry point to the [[aave-lending]] cycle — supplying assets earns yield and can serve as collateral for [[paytoll-aave-borrow]].

Before supplying, check [[paytoll-aave-best-yield]] to find the highest APY across chains, or use [[paytoll-aave-markets]] for an overview of all pools.

After supplying, monitor your position with [[paytoll-aave-health-factor]] if you plan to borrow. To exit, use [[paytoll-aave-withdraw]].

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAddress | string | Yes | Wallet address that will sign |
| tokenAddress | string | Yes | ERC20 token contract to supply |
| amount | string | Yes | Amount to supply (human-readable) |
| chainId | integer | Yes | Chain ID |
| marketAddress | string | No | Aave pool address |

## Example Input

```json
{
  "userAddress": "0x...",
  "tokenAddress": "0x...",
  "amount": "1000",
  "chainId": 8453
}
```
