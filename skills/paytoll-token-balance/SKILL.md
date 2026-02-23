---
name: paytoll-token-balance
description: >
  Check wallet token balance on any supported chain including Ethereum, Base,
  Polygon, Arbitrum, Optimism, BSC, and Avalanche. Costs $0.005 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Token Balance

Check wallet token balance on any supported chain via [[x402-payments]]. Supports native tokens and ERC20s.

Use before [[paytoll-aave-supply]] or [[paytoll-swap-build]] to verify available funds. Combine with [[paytoll-wallet-validator]] to verify addresses first.

Part of the [[defi]] domain. See also [[identity]] for wallet-related operations.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userAddress | string | Yes | Wallet address to check |
| chainId | integer | Yes | Chain ID (1=Ethereum, 8453=Base, 137=Polygon, 42161=Arbitrum) |
| tokenAddress | string | No | ERC20 contract address. Omit for native token (ETH, MATIC) |

## Example Input

```json
{
  "userAddress": "0x...",
  "chainId": 8453,
  "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```
