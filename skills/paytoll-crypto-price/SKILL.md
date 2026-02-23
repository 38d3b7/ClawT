---
name: paytoll-crypto-price
description: >
  Get real-time crypto prices for any CoinGecko-listed coin. Returns price in
  USD/EUR/GBP/JPY with optional 24h volume and market cap data. Costs $0.015.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Crypto Price

Get real-time cryptocurrency prices for any CoinGecko-listed coin via [[x402-payments]]. Returns price in USD/EUR/GBP/JPY with optional market data.

For DEX-derived on-chain prices (useful for new or low-cap tokens), use [[paytoll-onchain-token-price]]. For comprehensive token data including supply and top pools, use [[paytoll-onchain-token-data]].

Part of the [[defi]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | string | Yes | Crypto ticker (e.g., BTC, ETH) or CoinGecko ID |
| currency | string | No | Fiat currency: usd, eur, gbp, jpy (default: usd) |
| includeMarketData | boolean | No | Include 24h volume, market cap (default: false) |

## Example Input

```json
{
  "symbol": "ETH",
  "currency": "usd",
  "includeMarketData": true
}
```
