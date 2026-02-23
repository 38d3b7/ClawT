# CLAWT

**Verifiable AI Agent Platform on EigenCompute**

CLAWT deploys personal AI agents into Trusted Execution Environments (TEEs) with cryptographically signed responses. Users sign in with Ethereum wallets (MetaMask + SIWE), deploy agents, and submit natural-language tasks.

## Architecture

```
frontend/     Next.js web UI (Vercel)
backend/      Express orchestration API (VPS)
agent/        TEE agent with HD wallet (EigenCompute)
skills/       39 executable skill definitions
graph/        12-node capability navigation graph
shared/       Shared modules (paytoll-client.js)
scripts/      Registry maintenance scripts
```

## Skills Registry

The `skills/` directory contains 39 skills organized by domain:

- **DeFi** (17): Aave lending, DEX swaps, token prices, pool discovery
- **Social** (5): Twitter search, post, user/tweet lookup
- **AI** (4): LLM access (Anthropic, Google, OpenAI), image generation
- **Identity** (6): ENS names, wallet validation, token balances
- **Text Tools** (4): Summarize, translate, humanize
- **Search** (1): Tavily AI-optimized web search
- **Tools** (2): GitHub CLI, knowledge graphs

Each skill has a `SKILL.md` with YAML frontmatter defining:
- `name`, `description`, `version`, `author`
- `requires_env` — environment variables needed
- `execution` — shell commands to run

### PayToll Skills

Skills prefixed with `paytoll-` use x402 micropayments for API access. They share a common `paytoll-client.js` module.

## Skill Graph

The `graph/` directory contains navigation nodes that help the agent discover relevant skills:

- `index.md` — Entry point listing all domains
- Domain MOCs: `defi.md`, `social.md`, `ai.md`, `identity.md`, `text-tools.md`, `search.md`, `tools.md`
- Sub-MOCs: `aave-lending.md`, `dex-trading.md`, `ens-management.md`
- Concept: `x402-payments.md`

Nodes use `[[wikilinks]]` to reference other nodes and skills.

## Registry JSON

`registry.json` is auto-generated from skill metadata:

```bash
python scripts/generate-registry.py
```

This produces a machine-readable index with skill IDs, descriptions, content hashes, and environment requirements.

## Validation

Validate graph integrity (wikilinks, reachability, orphans):

```bash
python scripts/validate-graph.py
```

## CI Workflow

`.github/workflows/update-registry.yml` automatically regenerates `registry.json` when skills change on the `main` branch.

## Adding a New Skill

1. Create `skills/<skill-id>/SKILL.md` with frontmatter
2. Add execution script (`run.js`, `scripts/*.py`, etc.)
3. Link from appropriate graph node using `[[skill-id]]`
4. Run `python scripts/validate-graph.py` to verify
5. Commit — CI regenerates `registry.json`

## Environment Variables

Skills declare required env vars in their `requires_env` field. The agent filters available skills based on which vars are set.

## License

MIT
