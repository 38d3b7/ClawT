---
id: defi
description: >
  On-chain DeFi capabilities: lending/borrowing on Aave, DEX swaps, liquidity
  pool discovery, and real-time token pricing across chains.
skills:
  - paytoll-crypto-price
  - paytoll-onchain-token-price
  - paytoll-onchain-token-data
  - paytoll-token-balance
  - paytoll-aave-supply
  - paytoll-aave-borrow
  - paytoll-aave-withdraw
  - paytoll-aave-repay
  - paytoll-aave-health-factor
  - paytoll-aave-best-yield
  - paytoll-aave-best-borrow
  - paytoll-aave-markets
  - paytoll-aave-user-positions
  - paytoll-swap-quote
  - paytoll-swap-build
  - paytoll-search-pools
  - paytoll-trending-pools
links:
  - index
  - aave-lending
  - dex-trading
  - x402-payments
---

# DeFi

On-chain financial operations via [[x402-payments]]. Three main areas:

## Lending & Borrowing

Aave V3 is a decentralized lending protocol. Explore [[aave-lending]] for the full lifecycle:

- **Supply** assets to earn yield (and use as collateral)
- **Borrow** against your collateral
- **Monitor** health factor to avoid liquidation
- **Repay** loans and **withdraw** when done

Key skills: `paytoll-aave-supply`, `paytoll-aave-borrow`, `paytoll-aave-health-factor`

## DEX Trading

Swap tokens across decentralized exchanges. Explore [[dex-trading]] for the quote-then-swap flow:

- **Quote** to get expected output and price impact
- **Build** the swap transaction
- **Discover** pools via search or trending

Key skills: `paytoll-swap-quote`, `paytoll-swap-build`, `paytoll-search-pools`

## Token Data

Real-time pricing and on-chain token information:

- `paytoll-crypto-price` — CoinGecko prices in USD/EUR/GBP/JPY
- `paytoll-onchain-token-price` — DEX-derived on-chain prices
- `paytoll-onchain-token-data` — Token metadata, supply, holders
- `paytoll-token-balance` — Check wallet token balances

## Common Patterns

**Yield optimization**: Use `paytoll-aave-best-yield` to find the highest APY across chains, then `paytoll-aave-supply` to deposit.

**Position monitoring**: Use `paytoll-aave-user-positions` to see all positions, `paytoll-aave-health-factor` to check liquidation risk.

**Arbitrage discovery**: Use `paytoll-trending-pools` to find active markets, `paytoll-swap-quote` to check spreads.
