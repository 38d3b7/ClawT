---
name: paytoll-trending-pools
description: >
  Get trending liquidity pools on a network sorted by trading activity.
  Costs $0.015 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Trending Pools

Get trending liquidity pools on a network sorted by trading activity. Uses [[x402-payments]].

Use this to discover active trading opportunities before [[paytoll-swap-quote]]. For specific token searches, use [[paytoll-search-pools]].

Part of the [[dex-trading]] flow in [[defi]].

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | Yes | Network ID (eth, base, polygon_pos, arbitrum, optimism, solana) |

## Example Input

```json
{
  "network": "base"
}
```
