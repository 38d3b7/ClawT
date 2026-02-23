---
name: paytoll-aave-markets
description: >
  Get overview of all Aave V3 markets with TVL and rates. Costs $0.005
  per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Aave Markets

Get an overview of all Aave V3 markets with TVL and rates via [[x402-payments]]. Use this to explore lending opportunities before using [[paytoll-aave-supply]] or [[paytoll-aave-borrow]].

For specific yield/rate optimization, use [[paytoll-aave-best-yield]] or [[paytoll-aave-best-borrow]]. For individual position details, use [[paytoll-aave-user-positions]].

See [[aave-lending]] for market analysis guidance.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| chainIds | array | No | Specific chain IDs (default: all major chains) |
| topAssetsCount | integer | No | Top assets to include per market (default: 5, max: 20) |

## Example Input

```json
{
  "chainIds": [8453, 42161],
  "topAssetsCount": 10
}
```
