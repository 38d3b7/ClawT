---
name: paytoll-ens-lookup
description: >
  Resolve ENS names to Ethereum addresses and perform reverse lookups.
  Optionally resolve avatar and text records. Costs $0.001 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# ENS Lookup

Resolve ENS names to Ethereum addresses and perform reverse lookups via [[x402-payments]]. Can also resolve avatar and text records.

Use before sending funds to verify addresses. Combine with [[paytoll-wallet-validator]] for full address verification.

Part of the [[ens-management]] flow in the [[identity]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | No | ENS name (e.g., vitalik.eth) |
| address | string | No | Ethereum address for reverse lookup |
| resolveAvatar | boolean | No | Resolve avatar image (default: false) |
| resolveText | array | No | Text records to resolve |

## Example Input

```json
{
  "name": "vitalik.eth",
  "resolveAvatar": true
}
```
