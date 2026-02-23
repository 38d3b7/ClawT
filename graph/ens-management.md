---
id: ens-management
description: >
  ENS name lifecycle: check availability, commit-reveal registration,
  renewal, and address resolution.
skills:
  - paytoll-ens-check
  - paytoll-ens-commit
  - paytoll-ens-register
  - paytoll-ens-renew
  - paytoll-ens-lookup
links:
  - identity
  - x402-payments
---

# ENS Management

Ethereum Name Service (ENS) provides human-readable names for Ethereum addresses. Instead of `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`, use `vitalik.eth`.

## Registration Lifecycle

ENS uses a commit-reveal scheme to prevent front-running:

```
Check → Commit → Wait → Register → (later) Renew
```

### 1. Check Availability

- `paytoll-ens-check` — Returns availability and registration cost

If the name is taken, `paytoll-ens-lookup` shows the current owner.

### 2. Commit (Step 1 of 2)

Submit a hash of your intended registration. This reserves your intent without revealing the name.

- `paytoll-ens-commit` — Build commit transaction

### 3. Wait

Wait at least 1 minute (but no more than 24 hours) after the commit transaction confirms.

### 4. Register (Step 2 of 2)

Reveal your registration and pay the fee.

- `paytoll-ens-register` — Build registration transaction

### 5. Renew

Names expire. Renew before expiration to keep ownership.

- `paytoll-ens-renew` — Build renewal transaction

## Resolution

Convert between names and addresses:

- `paytoll-ens-lookup` — Resolve `name.eth` → address or address → primary name

## Pricing

ENS registration costs vary by name length:
- 5+ characters: ~$5/year
- 4 characters: ~$160/year
- 3 characters: ~$640/year

API calls cost $0.005-0.01 via [[x402-payments]]. On-chain registration requires ETH for the name fee plus gas.

## Common Patterns

**Register a name**: Check → Commit → Wait 1 min → Register

**Gift a name**: Register with recipient's address as owner

**Bulk renewal**: Query expiration with lookup, renew names nearing expiration
