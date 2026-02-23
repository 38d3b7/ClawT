---
name: paytoll-wallet-validator
description: >
  Validate cryptocurrency wallet addresses with checksum verification for
  Ethereum, Bitcoin, and Solana networks. Costs $0.0005 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Wallet Validator

Validate cryptocurrency wallet addresses with checksum verification for Ethereum, Bitcoin, and Solana via [[x402-payments]].

Use this before any operation that sends funds or interacts with user-provided addresses. Combine with [[paytoll-ens-lookup]] to resolve ENS names to addresses.

Part of the [[identity]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address to validate |
| network | string | No | Network type: ethereum, bitcoin, solana, auto (default: auto) |
| strict | boolean | No | Enforce checksum validation (default: true) |

## Example Input

```json
{
  "address": "0x...",
  "network": "ethereum",
  "strict": true
}
```
