---
name: paytoll-twitter-search
description: >
  Search recent tweets (last 7 days) on X/Twitter. Supports advanced query
  syntax. Costs $0.08 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Twitter Search

Search recent tweets (last 7 days) on X/Twitter via [[x402-payments]]. Supports advanced query syntax for filtering.

Use with [[paytoll-twitter-user-lookup]] to research authors of interesting tweets, or [[paytoll-twitter-tweet-lookup]] to get more details on specific tweets.

Part of the [[social]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query (X API syntax, e.g., "bitcoin lang:en -is:retweet") |
| maxResults | integer | No | Results count 10-20 (default: 10) |
| sortOrder | string | No | Sort: recency (default) or relevancy |
| nextToken | string | No | Pagination token |
| tweetFields | array | No | Fields to return |
| includeAuthor | boolean | No | Include author objects (default: true) |

## Example Input

```json
{
  "query": "ethereum lang:en -is:retweet",
  "maxResults": 15
}
```
