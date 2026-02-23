---
name: paytoll-twitter-user-tweets
description: >
  Get a user's recent tweets by user ID. Can exclude replies and retweets.
  Costs $0.08 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# Twitter User Tweets

Get a user's recent tweets by user ID via [[x402-payments]]. Can filter out replies and retweets.

First get the user ID with [[paytoll-twitter-user-lookup]], then fetch their tweets. Use [[paytoll-twitter-tweet-lookup]] for detailed metrics on specific tweets.

Part of the [[social]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | string | Yes | Twitter user ID |
| maxResults | integer | No | Tweets to return 5-20 (default: 10) |
| excludeReplies | boolean | No | Exclude reply tweets (default: false) |
| excludeRetweets | boolean | No | Exclude retweets (default: false) |
| nextToken | string | No | Pagination token |
| tweetFields | array | No | Fields to return |

## Example Input

```json
{
  "userId": "44196397",
  "maxResults": 10,
  "excludeRetweets": true
}
```
