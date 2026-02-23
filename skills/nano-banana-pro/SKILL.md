---
name: nano-banana-pro
description: >
  Generate and edit images with Google Gemini 3 Pro Image API. Supports
  text-to-image and image-to-image editing at 1K/2K/4K resolutions.
version: 1.0.1
author: clawhub
requires_env:
  - GEMINI_API_KEY
execution:
  - run: uv run scripts/generate_image.py {{input}}
dependencies:
  - uv
  - python3
---

# Nano Banana Pro Image Generation

Generate new images or edit existing ones using Google's Gemini 3 Pro Image API. Part of [[ai]] domain for creative image generation.

For text-based AI tasks, see [[paytoll-llm-google]] or other [[ai]] skills.

## Usage

**Generate new image:**

```bash
uv run scripts/generate_image.py --prompt "your image description" --filename "output.png" [--resolution 1K|2K|4K]
```

**Edit existing image:**

```bash
uv run scripts/generate_image.py --prompt "editing instructions" --filename "output.png" --input-image "path/to/input.png"
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| --prompt | string | Yes | Image description or editing instructions |
| --filename | string | Yes | Output filename (e.g., sunset.png) |
| --input-image | string | No | Input image path for editing mode |
| --resolution | string | No | 1K (default), 2K, or 4K |
| --api-key | string | No | Override GEMINI_API_KEY env var |

## Resolution Options

- **1K** (default) — ~1024px, fast iteration
- **2K** — ~2048px, balanced quality
- **4K** — ~4096px, final output quality

## Workflow

1. **Draft (1K)** — Quick iteration to refine prompt
2. **Iterate** — Adjust prompt, keep 1K for speed
3. **Final (4K)** — Generate high-res when prompt is locked

## Examples

Generate:

```bash
uv run scripts/generate_image.py --prompt "A serene Japanese garden with cherry blossoms" --filename "garden.png" --resolution 4K
```

Edit:

```bash
uv run scripts/generate_image.py --prompt "make the sky more dramatic" --filename "edited.png" --input-image "original.jpg"
```

## Notes

Requires `uv` (Python package runner) and `GEMINI_API_KEY` environment variable.
