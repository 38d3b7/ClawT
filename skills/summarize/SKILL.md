---
name: summarize
description: >
  Summarize URLs, files, PDFs, images, audio, and YouTube links using the
  summarize CLI. Requires external binary — not TEE-compatible.
version: 1.0.0
author: clawhub
requires_env: []
---

# Summarize CLI

Fast CLI to summarize URLs, local files, and YouTube links. Part of [[text-tools]] for content summarization.

> **TEE Warning:** Requires `summarize` CLI binary installed via Homebrew (`brew install steipete/tap/summarize`). Not available in TEE Docker containers. For TEE-compatible summarization, use [[summarize-text]] or [[ai]] skills.

## Quick Start

```bash
summarize "https://example.com" --model google/gemini-3-flash-preview
summarize "/path/to/file.pdf" --model google/gemini-3-flash-preview
summarize "https://youtu.be/dQw4w9WgXcQ" --youtube auto
```

## Model + API Keys

Set the API key for your chosen provider:

| Provider | Environment Variable |
|----------|---------------------|
| Google | `GEMINI_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| xAI | `XAI_API_KEY` |

Default model: `google/gemini-3-flash-preview`

## Options

| Flag | Description |
|------|-------------|
| `--length` | short, medium, long, xl, xxl, or character count |
| `--max-output-tokens` | Limit output tokens |
| `--extract-only` | Extract content without summarizing (URLs only) |
| `--json` | Machine-readable output |
| `--firecrawl` | auto, off, always (fallback extraction) |
| `--youtube` | auto (uses Apify fallback if `APIFY_API_TOKEN` set) |

## Config

Optional config file: `~/.summarize/config.json`

```json
{ "model": "openai/gpt-5.2" }
```

## Installation

```bash
brew install steipete/tap/summarize
```

## Notes

This is a documentation-only skill. The `summarize` binary must be installed separately. For TEE deployments, use [[summarize-text]] instead.
