---
name: paytoll-onchain-token-data
description: >
  Get comprehensive on-chain token data including price, supply, FDV, market
  cap, and top pools. Powered by GeckoTerminal. Costs $0.015 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# On-Chain Token Data

Get comprehensive on-chain token data including price, supply, FDV, market cap, and top pools via [[x402-payments]]. Powered by GeckoTerminal.

For just the price, use [[paytoll-onchain-token-price]] or [[paytoll-crypto-price]]. Combine with [[paytoll-search-pools]] to explore trading opportunities.

Part of the [[defi]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | Yes | Network ID (eth, base, polygon_pos, arbitrum, optimism, solana) |
| contractAddress | string | Yes | Token contract address |

## Example Input

```json
{
  "network": "base",
  "contractAddress": "0x..."
}
```
