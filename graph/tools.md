---
id: tools
description: >
  Developer tooling and utilities: GitHub CLI operations, knowledge graphs,
  and agent infrastructure. Documentation and local-only skills.
skills:
  - github
  - ontology
links:
  - index
---

# Tools

Developer utilities and infrastructure skills. Part of the [[index]] skill graph.

## GitHub CLI

- `github` — Reference commands for `gh` CLI operations

Use for: PR checks, workflow runs, issue management, API queries.

## Knowledge Graph

- `ontology` — Typed knowledge graph for structured agent memory

Use for: entity management, cross-skill state, planning as graph transformations.

> **Note:** `ontology` uses local filesystem storage and is not TEE-compatible without adaptation.

## When to Use

**GitHub skill:**
- Check CI status on pull requests
- List and view workflow runs
- Query GitHub API for repository data

**Ontology skill:**
- Remember facts and relationships
- Query knowledge across sessions
- Plan multi-step work as graph operations

## TEE Compatibility

| Skill | TEE Compatible | Notes |
|-------|----------------|-------|
| `github` | Partial | Needs `gh` CLI pre-installed and authenticated |
| `ontology` | No | Local filesystem storage; adapt for external storage |
