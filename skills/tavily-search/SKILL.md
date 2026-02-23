---
name: tavily-search
description: >
  AI-optimized web search via Tavily API. Returns concise, relevant results
  designed for AI agents. Supports deep research and news filtering.
version: 1.0.0
author: clawhub
requires_env:
  - TAVILY_API_KEY
execution:
  - run: node scripts/search.mjs {{input}}
dependencies:
  - node
---

# Tavily Search

AI-optimized web search using Tavily API. Part of [[search]] domain — returns clean, relevant content designed for AI agents.

For general web information, this skill provides better results than raw web scraping. See also [[ai]] skills for LLM-based research.

## Search

```bash
node scripts/search.mjs "query"
node scripts/search.mjs "query" -n 10
node scripts/search.mjs "query" --deep
node scripts/search.mjs "query" --topic news
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| -n | number | No | Number of results (default: 5, max: 20) |
| --deep | flag | No | Advanced search for deeper research |
| --topic | string | No | `general` (default) or `news` |
| --days | number | No | For news, limit to last n days |

## Extract Content from URL

```bash
node scripts/extract.mjs "https://example.com/article"
```

## Examples

Basic search:

```bash
node scripts/search.mjs "latest developments in AI safety"
```

Deep research:

```bash
node scripts/search.mjs "quantum computing applications in cryptography" --deep -n 10
```

Recent news:

```bash
node scripts/search.mjs "tech layoffs" --topic news --days 7
```

## Notes

- Get API key from https://tavily.com
- Tavily returns AI-optimized snippets, not raw HTML
- Use `--deep` for complex research questions
- Use `--topic news` for current events
