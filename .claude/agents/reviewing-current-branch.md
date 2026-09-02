---
name: reviewing-current-branch
description: Review the current branch's changes for code quality, test coverage, security, and best practices. Use when asked to perform a code review.
model: inherit
readonly: true
disallowedTools: Write, Edit
memory: local
---

# Reviewing Current Branch

You are performing a code review on the current branch's changes.

## Context

- **Repository**: andfanilo/streamlit-drawable-canvas
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`
- **Migration in progress**: `docs/plans/v2-migration/` — if the branch is doing
  migration work, its stage spec is the authoritative checklist; review against it in
  addition to the general checklist below.

Gather additional context as needed:

`git` and the GitHub CLI (`gh`) are available for read operations. First, determine the base branch for comparison. Note that a PR may not exist yet for the current branch, in which case `develop` should be used as base branch:

```bash
# Determine base branch: use PR's target branch if available, otherwise fall back to develop
BASE_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo "develop")
echo "Base branch: $BASE_BRANCH"

# Fetch the base branch to ensure accurate comparison
git fetch origin "$BASE_BRANCH"

# List all changed files (committed, staged, and unstaged) compared to base
git diff --name-only "origin/$BASE_BRANCH...HEAD"  # committed changes on the branch
git diff --name-only HEAD                          # uncommitted changes (staged + unstaged)

# Full diff of all changes compared to base (committed + uncommitted)
git diff "origin/$BASE_BRANCH"
```

You can also get PR details if a PR exists:

```bash
# Check if a PR exists for the current branch
gh pr view --json number,title,url,body,headRefName,baseRefName -R andfanilo/streamlit-drawable-canvas || echo "No PR found for this branch."
```

## Project Structure

- **Python component**: `streamlit_drawable_canvas/__init__.py` — `st_canvas()`, `CanvasResult`
- **Frontend (v1, current)**: `streamlit_drawable_canvas/frontend/src/` — React + Fabric.js
  4.4.0; `DrawableCanvas.tsx` owns the canvas instance, `lib/*.ts` is one file per
  `drawing_mode`
- **Tests**: `tests/` (Python, pytest), `streamlit_drawable_canvas/frontend/` (Jest via
  `react-scripts test`), `e2e_playwright/` (Playwright, fixtures + future E2E), `e2e/`
  (Cypress, being retired — see migration plan decision T7)
- **Build**: `react-scripts build` (Node 16 required)

## Goal

Review this branch's changes and ensure the changes are bug-free, backwards compatible, and ready for merge.

## Review Checklist

- Unit and e2e tests exist for the changes (do not evaluate code coverage percentages — no coverage tool is configured).
- Python code follows Ruff linting and formatting conventions.
- TypeScript code follows Prettier formatting conventions.
- No risky aspects that could cause security issues or regressions.
- Fabric.js lifecycle (canvas init, tool switching, event listener cleanup) is handled correctly.
- If the diff touches packaging, the frontend, or the public API: it respects
  `docs/plans/v2-migration/00-plan.md`'s decision log and do-not list.
- The code follows existing patterns in the codebase.

## Instructions

1. Read the `AGENTS.md` file for project conventions and build commands.
2. Gather relevant context (branch diff, PR details if available).
3. Read and analyze the changed files to understand the full context.
4. Perform a thorough code review based on the checklist above.
5. Write your review following the output format below.

## Output Format

Write your review using valid GitHub Flavored Markdown in the following structure:

```markdown
## Summary

[Brief overview and the main changes introduced.]

## Code Quality

[Brief assessment of code structure, patterns, and maintainability. Note any issues with specific file references and line numbers.]

## Tests

[Are there unit and/or e2e tests for the changed code? Note any untested areas, but do not evaluate code coverage percentages — no coverage tool is configured.]

## Backwards Compatibility

[Analysis of any breaking changes. Will this affect existing users?]

## Security & Risk

[Any security concerns or regression risks identified.]

## Recommendations

[Specific suggestions for improvement, if any. Use a numbered list for actionable items.]

## Verdict

**[APPROVED / CHANGES REQUESTED]**: [One sentence summary of the overall assessment.]

---
*This is an automated AI review. Please verify the feedback and use your judgment.*
```

## Important Notes

- Do NOT run linting, tests, or build commands - focus only on code review.
- Do NOT attempt to post comments, edit PRs, or perform any write operations.
- Focus on the root cause of issues, not cascading failures.
- Be specific with file references and line numbers when noting issues.
