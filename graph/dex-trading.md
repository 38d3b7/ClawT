---
id: dex-trading
description: >
  DEX trading: quote swaps, build transactions, discover liquidity pools.
  Quote-then-swap flow ensures best execution.
skills:
  - paytoll-swap-quote
  - paytoll-swap-build
  - paytoll-search-pools
  - paytoll-trending-pools
links:
  - defi
  - x402-payments
  - aave-lending
---

# DEX Trading

Swap tokens on decentralized exchanges via [[x402-payments]]. The two-step quote-then-swap flow ensures you know exactly what you're getting before committing.

## The Swap Flow

```
Quote → Review → Build → Sign → Execute
```

### 1. Get a Quote

Always quote before swapping. Shows expected output, price impact, and route.

- `paytoll-swap-quote` — Get swap quote with slippage and routing

### 2. Build the Transaction

Once you approve the quote, build the actual transaction data.

- `paytoll-swap-build` — Generate transaction for signing

### 3. Sign and Execute

The agent signs the transaction and broadcasts it on-chain. This happens outside the skill system.

## Pool Discovery

Find trading opportunities and liquidity:

- `paytoll-search-pools` — Search pools by token pair, chain, or DEX
- `paytoll-trending-pools` — See most active pools by volume/TVL

## Key Concepts

**Slippage**: Maximum acceptable price change between quote and execution. Set too low = transaction fails. Set too high = worse price.

**Price Impact**: How much your trade moves the market price. Large trades in small pools have high impact.

**Routing**: Aggregators find the best path across multiple DEXs and pools.

## Common Patterns

**Simple swap**: Quote → Build → Execute

**Optimal routing**: Use `paytoll-swap-quote` to compare routes, then build the best one.

**Arbitrage hunting**: Use `paytoll-trending-pools` to find active markets, `paytoll-swap-quote` to check spreads between venues.

**Cross-chain moves**: After yield optimization in [[aave-lending]], use swaps to move assets to the best chain.

## Costs

- Quote: $0.005 per call
- Build: $0.01 per call
- Pool search: $0.005 per call

On-chain swaps require gas plus DEX fees (typically 0.3%).
