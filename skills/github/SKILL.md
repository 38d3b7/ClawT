---
name: github
description: >
  Interact with GitHub using the gh CLI. Use gh issue, gh pr, gh run,
  and gh api for issues, PRs, CI runs, and advanced queries.
version: 1.0.0
author: clawhub
requires_env: []
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub. Part of [[tools]] — a documentation reference for GitHub operations.

Always specify `--repo owner/repo` when not in a git directory, or use URLs directly.

## Pull Requests

Check CI status on a PR:

```bash
gh pr checks 55 --repo owner/repo
```

List recent workflow runs:

```bash
gh run list --repo owner/repo --limit 10
```

View a run and see which steps failed:

```bash
gh run view <run-id> --repo owner/repo
```

View logs for failed steps only:

```bash
gh run view <run-id> --repo owner/repo --log-failed
```

## API for Advanced Queries

The `gh api` command is useful for accessing data not available through other subcommands.

Get PR with specific fields:

```bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
```

## JSON Output

Most commands support `--json` for structured output. Use `--jq` to filter:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## Notes

This is a documentation-only skill providing reference commands. The `gh` CLI must be pre-authenticated in the execution environment.
