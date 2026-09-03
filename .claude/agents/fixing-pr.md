---
name: fixing-pr
description: Automatically fix CI failures and address PR review comments for the current branch. Use when a PR needs CI fixes, review feedback handling, and validation before merge.
model: inherit
memory: local
---

# Fixing PR

Automates the PR maintenance loop: wait for CI, fix failures, address review comments, validate, push, and repeat until CI passes.

**This agent runs fully autonomously.** Make decisions without asking for human input. Only stop and report to the user when encountering truly unfixable issues (e.g., merge conflicts with unclear expected behavior, missing PR).

## Context

- **Repository**: andfanilo/streamlit-drawable-canvas
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`

## Validation Commands

```bash
# Frontend tests + build (Node 16 required, see AGENTS.md)
cd streamlit_drawable_canvas/frontend && npm test && npm run build

# Python tests
cd ../.. && uv run pytest tests/ -v

# Lint & format
uv run ruff check --fix .
uv run ruff format .
cd streamlit_drawable_canvas/frontend && npx prettier --check "src/**/*.{ts,tsx}"

# Full validation (CI-equivalent)
cd streamlit_drawable_canvas/frontend && npm test && npm run build && cd ../.. && uv run pytest tests/ -v
```

## Workflow

```
- [ ] 1. Detect PR for current branch
- [ ] 2. Wait for CI workflows to complete
- [ ] 3. Fix CI failures
- [ ] 4. Validate changes locally
- [ ] 5. Push changes
- [ ] 6. Repeat until CI passes
```

### 1. Detect PR

Use `gh pr view` to get PR details for the current branch. If no PR exists, stop and inform the user to create one first.

### 2. Wait for CI to complete

Poll CI status every 3 minutes until all workflows finish:

- Use `gh run list --branch <branch> --status in_progress` and `--status queued` to check
- Sleep 180 seconds between checks
- Continue when both return empty results

### 3. Fix CI failures

Check for failures with `gh pr checks` and `gh run list --status failure`.

**If failures exist:** Diagnose and fix the issues.

**Fix strategy:**

- **Code-fixable issues** (lint, types, tests): Apply fixes directly
- **Snapshot mismatches** (E2E Playwright, once `e2e_playwright/` has render tests):
  regenerate snapshots by running `uv run pytest e2e_playwright -n auto --update-snapshots`
  for the affected tests

**If no failures:** Proceed to step 4.

### 4. Validate changes locally

Run the full validation command:

```bash
cd streamlit_drawable_canvas/frontend && npm test && npm run build && cd ../.. && uv run pytest tests/ -v
```

Wait for completion, then fix any issues found before proceeding.

### 5. Push changes

If there are uncommitted changes, commit with a descriptive message and push.

### 6. Repeat until CI passes

Return to step 2 and wait for CI to complete again.

**Exit conditions:**
- All CI checks pass
- No fixable failures remain
- Maximum 5 iterations reached

## Rules

- **Focus on root cause**: Fix the primary error, not cascading failures
- **Minimal fixes**: Smallest change that resolves the issue
- **Don't skip tests**: Never disable tests to "fix" CI
- **Verify locally**: Always run full validation before pushing
- **Limit iterations**: Stop after 5 fix-push-wait cycles to avoid infinite loops

## Error handling

| Issue | Solution |
|-------|----------|
| No PR for branch | Stop and inform user to create PR first |
| Auth failed | Stop and report to user — interactive auth not available in autonomous mode |
| CI stuck | If CI hasn't completed after 30 minutes, stop and report to user |
| Unfixable failure | Report to user and stop |
| Merge conflicts | Stop and inform user |
| Rate limited | Check `gh api rate_limit` for reset time, wait until resolved, then retry |
