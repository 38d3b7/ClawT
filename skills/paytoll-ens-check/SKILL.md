---
name: paytoll-ens-check
description: >
  Check ENS name availability and registration price. Free endpoint - no
  x402 payment required.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# ENS Check

Check ENS name availability and registration price. This is the first step in the [[ens-management]] flow.

If the name is available, proceed with [[paytoll-ens-commit]] to start registration. If taken, use [[paytoll-ens-lookup]] to see who owns it.

Part of the [[identity]] domain. Free endpoint — no [[x402-payments]] required.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | ENS name to check (without .eth suffix) |

## Example Input

```json
{
  "name": "myname"
}
```
