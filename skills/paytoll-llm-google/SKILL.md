---
name: paytoll-llm-google
description: >
  Google Gemini chat completions proxy. Access Gemini 2.0 Flash and Flash
  Lite models via pay-per-call. Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# LLM Google

Access Google Gemini models via [[x402-payments]] without managing API keys. Best for multimodal tasks, broad knowledge, and fast responses.

For simpler text tasks, [[text-tools]] may be more cost-effective. For alternative models, see [[paytoll-llm-anthropic]] or [[paytoll-llm-openai]].

Part of the [[ai]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messages | array | Yes | Conversation messages |
| model | string | No | Model: gemini-2.0-flash or gemini-2.0-flash-lite (default) |
| temperature | number | No | Sampling temperature 0-2 (default: 0.7) |
| max_tokens | integer | No | Max output tokens 1-4096 (default: 1024) |

## Example Input

```json
{
  "messages": [
    {"role": "user", "content": "Explain quantum computing in simple terms"}
  ],
  "model": "gemini-2.0-flash"
}
```
