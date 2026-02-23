---
name: paytoll-ens-register
description: >
  Build a register transaction for ENS name registration (step 2 of 2-step
  process). Must wait at least 1 minute after commit. Free endpoint.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# ENS Register

Build a register transaction for ENS registration — step 2 of the 2-step [[ens-management]] process.

Must be called at least 1 minute after [[paytoll-ens-commit]] (step 1) confirms, and within 24 hours. Use the same secret from the commit step.

After registration, use [[paytoll-ens-renew]] before expiration. Part of the [[identity]] domain. Free endpoint — no [[x402-payments]] required.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | ENS name to register (without .eth) |
| userAddress | string | Yes | Wallet address (must match commit step) |
| duration | integer | No | Registration duration (must match commit) |
| secret | string | Yes | The secret from the commit step |
| reverseRecord | boolean | No | Set as primary ENS name (must match commit) |

## Example Input

```json
{
  "name": "myname",
  "userAddress": "0x...",
  "secret": "0x..."
}
```
