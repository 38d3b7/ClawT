---
name: paytoll-ens-renew
description: >
  Build a renewal transaction for an existing ENS name. Free endpoint -
  no x402 payment required.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# ENS Renew

Build a renewal transaction for an existing ENS name. Part of the [[ens-management]] lifecycle.

Use [[paytoll-ens-lookup]] to check expiration dates before renewing.

Part of the [[identity]] domain. Free endpoint — no [[x402-payments]] required.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | ENS name to renew (without .eth) |
| duration | integer | No | Renewal duration in seconds (default: 1 year) |

## Example Input

```json
{
  "name": "myname",
  "duration": 31536000
}
```
