---
name: paytoll-llm-anthropic
description: >
  Anthropic Claude chat completions proxy. Access Claude 3.5 Haiku and Claude
  3 Haiku models via pay-per-call. Costs $0.01 per call.
version: 1.0.0
author: clawt
requires_env: []
execution:
  - run: node run.js {{input}}
---

# LLM Anthropic

Access Anthropic Claude models via [[x402-payments]] without managing API keys. Best for complex reasoning, code generation, and nuanced analysis.

For simpler text tasks, [[text-tools]] may be more cost-effective. For alternative models, see [[paytoll-llm-google]] or [[paytoll-llm-openai]].

Part of the [[ai]] domain.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| messages | array | Yes | Conversation messages |
| model | string | No | Model: claude-3-5-haiku-20241022 or claude-3-haiku-20240307 (default) |
| temperature | number | No | Sampling temperature 0-2 (default: 0.7) |
| max_tokens | integer | No | Max output tokens 1-4096 (default: 1024) |

## Example Input

```json
{
  "messages": [
    {"role": "user", "content": "What is the capital of France?"}
  ],
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.7
}
```
