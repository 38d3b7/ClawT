---
id: ai
description: >
  Access to frontier LLMs and image generation: Anthropic Claude, Google Gemini,
  OpenAI GPT, plus Gemini image generation. Pay per call or use API keys.
skills:
  - paytoll-llm-anthropic
  - paytoll-llm-google
  - paytoll-llm-openai
  - nano-banana-pro
links:
  - index
  - x402-payments
  - text-tools
  - search
---

# AI

Access frontier LLMs via [[x402-payments]] without managing API keys. Three providers:

## Anthropic Claude

- `paytoll-llm-anthropic` — Claude 3.5 Sonnet for analysis, coding, reasoning

Best for: complex reasoning, code generation, nuanced analysis.

## Google Gemini

- `paytoll-llm-google` — Gemini Pro for general tasks

Best for: multimodal tasks, broad knowledge, fast responses.

## OpenAI GPT

- `paytoll-llm-openai` — GPT-4 for general intelligence

Best for: creative writing, broad capabilities, function calling.

## Image Generation

- `nano-banana-pro` — Gemini 3 Pro Image for text-to-image and image editing

Best for: generating images from prompts, editing existing images, creative visuals.

Requires `GEMINI_API_KEY` environment variable.

## When to Use

Use these skills when the task requires capabilities beyond the agent's built-in routing:

- **Deep analysis** of complex documents or data
- **Code generation** for custom scripts
- **Creative writing** that needs a specific style
- **Domain expertise** the agent doesn't have built-in

For simpler text tasks like summarization or translation, see [[text-tools]] which may be more cost-effective.

## Costs

Pricing varies by model and token count. Typical costs:
- Anthropic: ~$0.01-0.05 per request
- Google: ~$0.005-0.02 per request
- OpenAI: ~$0.01-0.05 per request

All payments handled automatically via [[x402-payments]].
