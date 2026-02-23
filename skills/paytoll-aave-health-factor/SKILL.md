---
name: paytoll-aave-health-factor
description: >
  Get health factor and liquidation risk for an Aave V3 position.
  Costs $0.005 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Health Factor

Get position health and liquidation risk via [[x402-payments]]. The health factor is the ratio of collateral value to borrowed value — below 1.0 means liquidation.

Check this before and after [[paytoll-aave-borrow]] or [[paytoll-aave-withdraw]] operations. If health factor is low, use [[paytoll-aave-repay]] to improve it.

For a complete view of all positions, use [[paytoll-aave-user-positions]]. See [[aave-lending]] for risk management guidance.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAddress | string | Yes | Wallet address to check |
| chainId | integer | Yes | Chain ID |
| marketAddress | string | No | Aave pool address |

## Example Input

```json
{
  "userAddress": "0x...",
  "chainId": 8453
}
```
