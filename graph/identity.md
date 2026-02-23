---
id: identity
description: >
  On-chain identity: ENS name registration and management, wallet validation,
  token balance checks.
skills:
  - paytoll-ens-check
  - paytoll-ens-commit
  - paytoll-ens-register
  - paytoll-ens-renew
  - paytoll-ens-lookup
  - paytoll-wallet-validator
links:
  - index
  - ens-management
  - x402-payments
---

# Identity

On-chain identity and wallet operations via [[x402-payments]].

## ENS Names

Ethereum Name Service lets you use human-readable names like `vitalik.eth` instead of `0x...` addresses. Explore [[ens-management]] for the full registration lifecycle.

Quick reference:
- `paytoll-ens-check` — Check if a name is available
- `paytoll-ens-lookup` — Resolve name ↔ address
- `paytoll-ens-commit` → `paytoll-ens-register` — Two-step registration
- `paytoll-ens-renew` — Extend registration

## Wallet Validation

- `paytoll-wallet-validator` — Validate Ethereum addresses, check checksums, detect contract vs EOA

## Common Patterns

**Name registration**: Check availability with `paytoll-ens-check`, then follow the [[ens-management]] commit-reveal flow.

**Address lookup**: Use `paytoll-ens-lookup` to resolve names before sending transactions.

**Wallet verification**: Use `paytoll-wallet-validator` before any operation that sends funds.

## Costs

ENS operations: $0.005-0.01 per call (API cost only; registration requires on-chain ETH).
Wallet validation: $0.005 per call.
