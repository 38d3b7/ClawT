---
name: paytoll-search-pools
description: >
  Search liquidity pools by token name, symbol, or contract address across
  multiple networks. Costs $0.015 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Search Pools

Search liquidity pools by token name, symbol, or contract address across networks. Uses [[x402-payments]].

Use this to discover trading opportunities before [[paytoll-swap-quote]]. For trending/active markets, see [[paytoll-trending-pools]].

Part of the [[dex-trading]] flow in [[defi]].

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Token name, symbol, or contract address (e.g., "PEPE", "WETH", "0x...") |

## Example Input

```json
{
  "query": "PEPE"
}
```
