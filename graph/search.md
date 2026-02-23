---
id: search
description: >
  Web search capabilities optimized for AI agents. Get clean, relevant
  results without raw HTML parsing.
skills:
  - tavily-search
links:
  - index
  - ai
---

# Search

Web search skills optimized for AI agents. Part of the [[index]] skill graph.

## Tavily Search

- `tavily-search` — AI-optimized web search via Tavily API

Use for: research queries, news lookup, content extraction from URLs.

## When to Use

Use [[search]] skills when you need:

- **Real-time information** not in training data
- **Current events** and news
- **Research** on specific topics
- **URL content extraction** without HTML parsing

## Comparison with AI Skills

| Need | Use |
|------|-----|
| Web search results | [[search]] (`tavily-search`) |
| Generate/analyze text | [[ai]] (LLM skills) |
| Both | Search first, then process with AI |

## Example Workflow

1. Search for information: `tavily-search "quantum computing news" --topic news`
2. Extract specific article: `tavily-search extract "https://..."`
3. Analyze with AI: [[paytoll-llm-anthropic]] or [[paytoll-llm-openai]]

## Notes

- Tavily returns clean snippets optimized for AI consumption
- Use `--deep` for comprehensive research
- Use `--topic news` for current events
