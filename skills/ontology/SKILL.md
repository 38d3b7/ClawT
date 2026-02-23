---
name: ontology
description: >
  Typed knowledge graph for structured agent memory. Create/query entities
  (Person, Project, Task, Event, Document), link related objects, enforce
  constraints. Local filesystem storage — not TEE-compatible.
version: 0.1.2
author: clawhub
requires_env: []
execution:
  - run: python3 scripts/ontology.py {{input}}
dependencies:
  - python3
---

# Ontology

A typed vocabulary and constraint system for representing knowledge as a verifiable graph. Part of [[tools]] for agent memory and state management.

> **TEE Warning:** This skill uses local filesystem storage (`memory/ontology/`). TEE containers have no persistent storage — data is lost on stop/start/upgrade. For production use, adapt to external storage.

## Core Concept

Everything is an **entity** with a **type**, **properties**, and **relations** to other entities. Every mutation is validated against type constraints before committing.

```
Entity: { id, type, properties, relations, created, updated }
Relation: { from_id, relation_type, to_id, properties }
```

## When to Use

| Trigger | Action |
|---------|--------|
| "Remember that..." | Create/update entity |
| "What do I know about X?" | Query graph |
| "Link X to Y" | Create relation |
| "Show all tasks for project Z" | Graph traversal |
| "What depends on X?" | Dependency query |

## Core Types

```yaml
Person: { name, email?, phone?, notes? }
Organization: { name, type?, members[] }
Project: { name, status, goals[], owner? }
Task: { title, status, due?, priority?, assignee?, blockers[] }
Event: { title, start, end?, location?, attendees[] }
Document: { title, path?, url?, summary? }
Note: { content, tags[], refs[] }
```

## Workflows

### Create Entity

```bash
python3 scripts/ontology.py create --type Person --props '{"name":"Alice"}'
```

### Query

```bash
python3 scripts/ontology.py query --type Task --where '{"status":"open"}'
python3 scripts/ontology.py get --id task_001
python3 scripts/ontology.py related --id proj_001 --rel has_task
```

### Link Entities

```bash
python3 scripts/ontology.py relate --from proj_001 --rel has_task --to task_001
```

### Validate

```bash
python3 scripts/ontology.py validate
```

## Storage

Default: `memory/ontology/graph.jsonl`

```jsonl
{"op":"create","entity":{"id":"p_001","type":"Person","properties":{"name":"Alice"}}}
{"op":"relate","from":"proj_001","rel":"has_owner","to":"p_001"}
```

## Quick Start

```bash
mkdir -p memory/ontology
touch memory/ontology/graph.jsonl
python3 scripts/ontology.py create --type Person --props '{"name":"Alice"}'
python3 scripts/ontology.py list --type Person
```

## References

- `references/schema.md` — Full type definitions and constraints
- `references/queries.md` — Query language and traversal examples
