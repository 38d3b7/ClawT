---
name: paytoll-llm-openai
description: >
  OpenAI chat completions proxy. Access GPT-4o mini and GPT-3.5 Turbo
  models via pay-per-call. Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# LLM OpenAI

Access OpenAI GPT models via [[x402-payments]] without managing API keys. Best for creative writing, broad capabilities, and function calling.

For simpler text tasks, [[text-tools]] may be more cost-effective. For alternative models, see [[paytoll-llm-anthropic]] or [[paytoll-llm-google]].

Part of the [[ai]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messages | array | Yes | Conversation messages |
| model | string | No | Model: gpt-4o-mini (default) or gpt-3.5-turbo |
| temperature | number | No | Sampling temperature 0-2 (default: 0.7) |
| max_tokens | integer | No | Max output tokens 1-4096 (default: 1024) |

## Example Input

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a haiku about programming"}
  ]
}
```
