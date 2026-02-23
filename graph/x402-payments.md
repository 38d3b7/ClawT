---
id: x402-payments
description: >
  How PayToll x402 micropayments work. Skills prefixed with paytoll- use this
  protocol for pay-per-call API access.
links:
  - index
  - defi
  - social
  - ai
  - identity
---

# x402 Payments

Most skills in this agent use PayToll's x402 protocol for micropayments. Instead of managing API keys and subscriptions, you pay per call with crypto.

## How It Works

1. **Skill calls PayToll API** with the request
2. **PayToll returns HTTP 402** (Payment Required) with price and payment address
3. **TEE bridge handles payment** automatically using the agent's wallet
4. **PayToll processes request** and returns the result
5. **Skill outputs result** to the agent

The agent handles steps 2-4 transparently via the TEE bridge. You just call the skill.

## Cost Model

PayToll charges per API call:

| Category | Typical Cost |
|----------|--------------|
| Token prices | $0.01-0.015 |
| Aave operations | $0.005-0.01 |
| DEX quotes/swaps | $0.005-0.01 |
| ENS operations | $0.005-0.01 |
| Twitter operations | $0.02-0.05 |
| LLM calls | $0.01-0.05 |

Costs are in USD, paid in crypto (ETH, USDC, etc.) from the agent's TEE wallet.

## Which Skills Use x402?

All skills prefixed with `paytoll-` use x402 payments:
- `paytoll-crypto-price`
- `paytoll-aave-*`
- `paytoll-swap-*`
- `paytoll-ens-*`
- `paytoll-twitter-*`
- `paytoll-llm-*`

Skills without the prefix (like `humanize-ai-text`, `summarize-text`, `translate-text`) run locally and are free.

## Agent Wallet

The agent has a TEE-secured wallet derived from a mnemonic. This wallet:
- Holds funds for x402 payments
- Signs transactions for on-chain operations
- Cannot be accessed outside the TEE

Check wallet balance and address via the `/whoami` endpoint.

## Error Handling

If a payment fails (insufficient funds, network issue), the skill returns an error with:
- `error`: Error code
- `message`: Human-readable description
- `recoverable`: Whether retrying might help
- `suggestedAction`: What to do next

Common errors:
- `INSUFFICIENT_FUNDS` — Add funds to agent wallet
- `PAYMENT_TIMEOUT` — Retry the request
- `IPC_UNAVAILABLE` — Skill running outside TEE context
