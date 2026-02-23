---
id: index
description: >
  Entry point to the CLAWT capability graph. Lists all domains and
  executable skills. Use explore_skills to dive into any domain.
---

# Skill Graph

This agent has access to capabilities across five domains. For simple tasks, select skills directly from this index. For complex tasks, explore a domain first to understand how skills compose.

## Domains

- [[defi]] — On-chain finance: Aave lending, DEX swaps, pool discovery, token prices
- [[social]] — Twitter: search, post, user/tweet lookup
- [[ai]] — LLM access and image generation: Anthropic, Google, OpenAI, Gemini Image
- [[identity]] — ENS names, wallet validation, token balances
- [[text-tools]] — Text processing: summarize, translate, humanize
- [[search]] — AI-optimized web search via Tavily
- [[tools]] — Developer utilities: GitHub CLI, knowledge graphs

## All Skills by Domain

### DeFi
`paytoll-crypto-price` `paytoll-onchain-token-price` `paytoll-onchain-token-data` `paytoll-token-balance` `paytoll-aave-supply` `paytoll-aave-borrow` `paytoll-aave-withdraw` `paytoll-aave-repay` `paytoll-aave-health-factor` `paytoll-aave-best-yield` `paytoll-aave-best-borrow` `paytoll-aave-markets` `paytoll-aave-user-positions` `paytoll-swap-quote` `paytoll-swap-build` `paytoll-search-pools` `paytoll-trending-pools`

### Social
`paytoll-twitter-search` `paytoll-twitter-post` `paytoll-twitter-tweet-lookup` `paytoll-twitter-user-lookup` `paytoll-twitter-user-tweets`

### AI
`paytoll-llm-anthropic` `paytoll-llm-google` `paytoll-llm-openai` `nano-banana-pro`

### Identity
`paytoll-ens-check` `paytoll-ens-commit` `paytoll-ens-register` `paytoll-ens-renew` `paytoll-ens-lookup` `paytoll-wallet-validator`

### Text Tools
`humanize-ai-text` `summarize-text` `translate-text` `summarize`

### Search
`tavily-search`

### Tools
`github` `ontology`

## How to Use

1. For simple tasks like "get ETH price" → select `paytoll-crypto-price` directly
2. For complex tasks like "optimize my Aave position" → explore [[defi]] then [[aave-lending]] to understand the lending lifecycle before selecting skills
3. Skills prefixed with `paytoll-` use [[x402-payments]] micropayments
