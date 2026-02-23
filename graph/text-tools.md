---
id: text-tools
description: >
  Text processing utilities: summarize documents, translate between languages,
  humanize AI-generated text. Includes both local and CLI-based options.
skills:
  - humanize-ai-text
  - summarize-text
  - translate-text
  - summarize
links:
  - index
  - ai
---

# Text Tools

Built-in text processing that runs locally without [[x402-payments]]. Three utilities:

## Summarize

- `summarize-text` — Condense long text into key points

Use for: articles, documents, long messages, meeting notes.

## Translate

- `translate-text` — Translate between languages

Use for: multilingual communication, document translation.

## Humanize

- `humanize-ai-text` — Rewrite AI-generated text to sound more natural

Use for: editing drafts, reducing robotic tone, improving readability.

## Summarize CLI (Local)

- `summarize` — CLI tool for URLs, PDFs, images, audio, YouTube

Use for: summarizing web pages, documents, media files.

> **Note:** Requires `summarize` binary installed via Homebrew. Not TEE-compatible.

## When to Use Text Tools vs AI

**Text tools** (this category):
- Free (no x402 cost)
- Fast (local execution)
- Limited to specific operations

**AI skills** (see [[ai]]):
- Paid per call
- More flexible
- Can handle complex/custom prompts

For straightforward summarization or translation, use text tools. For nuanced analysis or custom instructions, use [[ai]] skills.
