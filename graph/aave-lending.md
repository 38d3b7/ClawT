---
id: aave-lending
description: >
  Aave V3 lending lifecycle: supply assets for yield, borrow against collateral,
  monitor health factors, manage repayments and withdrawals across chains.
skills:
  - paytoll-aave-supply
  - paytoll-aave-borrow
  - paytoll-aave-withdraw
  - paytoll-aave-repay
  - paytoll-aave-health-factor
  - paytoll-aave-best-yield
  - paytoll-aave-best-borrow
  - paytoll-aave-markets
  - paytoll-aave-user-positions
links:
  - defi
  - x402-payments
  - dex-trading
---

# Aave Lending

Aave V3 is the largest decentralized lending protocol. Users supply assets to earn yield, and can borrow against their collateral. All operations via [[x402-payments]].

## The Lending Lifecycle

```
Supply → (optional) Borrow → Monitor → Repay → Withdraw
```

### 1. Supply Assets

Deposit tokens to earn yield. Supplied assets can serve as collateral for borrowing.

- `paytoll-aave-supply` — Build supply transaction
- `paytoll-aave-best-yield` — Find highest APY across all chains first

### 2. Borrow Against Collateral

Once you have collateral, borrow other assets. The health factor determines how close you are to liquidation.

- `paytoll-aave-borrow` — Build borrow transaction
- `paytoll-aave-best-borrow` — Find lowest borrow APR across chains

### 3. Monitor Position

Liquidation happens when health factor drops below 1.0. Monitor regularly.

- `paytoll-aave-health-factor` — Check liquidation risk
- `paytoll-aave-user-positions` — See all positions across chains

### 4. Repay Loans

Pay back borrowed assets to improve health factor or close positions.

- `paytoll-aave-repay` — Build repay transaction

### 5. Withdraw

Remove supplied assets when done. Cannot withdraw collateral backing active loans.

- `paytoll-aave-withdraw` — Build withdraw transaction

## Market Discovery

- `paytoll-aave-markets` — Overview of all Aave V3 markets with TVL and rates

## Cross-Chain Strategy

Aave V3 runs on multiple chains (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche). Use `paytoll-aave-best-yield` and `paytoll-aave-best-borrow` to find optimal rates across all chains, then use [[dex-trading]] to move assets if needed.

## Risk Management

**Health Factor**: Ratio of collateral value to borrowed value. Below 1.0 = liquidation.

- > 2.0: Safe
- 1.5-2.0: Monitor closely
- 1.0-1.5: Danger zone, consider repaying
- < 1.0: Liquidation triggered

Use `paytoll-aave-health-factor` before and after any borrow operation.

## Costs

All Aave API calls cost $0.005-0.01 via [[x402-payments]]. On-chain transactions require gas in the native token.
