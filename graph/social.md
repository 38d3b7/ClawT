---
id: social
description: >
  Twitter/X capabilities: search tweets, post content, look up users and tweets.
  All operations use x402 micropayments.
skills:
  - paytoll-twitter-search
  - paytoll-twitter-post
  - paytoll-twitter-tweet-lookup
  - paytoll-twitter-user-lookup
  - paytoll-twitter-user-tweets
links:
  - index
  - x402-payments
---

# Social

Twitter/X operations via [[x402-payments]]. Five capabilities:

## Search & Discovery

Find tweets matching keywords, hashtags, or from specific users:

- `paytoll-twitter-search` — Search tweets by query, filter by date/engagement

## Content Creation

Post tweets from the agent's connected Twitter account:

- `paytoll-twitter-post` — Post a tweet (text only, no media yet)

## Lookup & Research

Get details about specific tweets or users:

- `paytoll-twitter-tweet-lookup` — Get a tweet by ID with engagement metrics
- `paytoll-twitter-user-lookup` — Get user profile by username or ID
- `paytoll-twitter-user-tweets` — Get recent tweets from a user

## Common Patterns

**Monitoring**: Search for mentions of a project, then look up engaging users to understand the audience.

**Research**: Look up a user's profile and recent tweets before engaging.

**Automated posting**: Post market updates, alerts, or summaries (compose with [[ai]] skills first).

## Costs

All Twitter operations cost $0.02-0.05 per call via [[x402-payments]].
