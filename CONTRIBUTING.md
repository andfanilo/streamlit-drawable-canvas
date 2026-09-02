# Contributing to streamlit-drawable-canvas

## AI-Assisted Development

This project includes configuration for AI coding agents in `.claude/`. Claude Code is the primary coding agent (implementation, reviews, CI fixes).

### Claude Code

| Command | Description |
|---|---|
| `/reviewing-current-branch` | Review the current branch's changes (vs base) for code quality, security, and best practices |
| `/simplifying-current-branch` | Simplify and refine the current branch's changes (vs base) for clarity and maintainability |
| `/fixing-pr` | Fix CI failures and address PR review comments for the current branch |
| `/criticizing-local-changes` | Critically review uncommitted changes (`git diff`) for bugs, style issues, and improvements |

| Skill | Description |
|---|---|
| `developing-with-streamlit` | Router skill for Streamlit development — routes to sub-skills covering components, layouts, theming, performance, data display, and more |

## Migration in progress

This repo is mid-migration from Streamlit Components v1 to v2 (see
`docs/plans/v2-migration/00-plan.md`). If your change touches packaging, the frontend,
or the public API, read that plan first — it is the authoritative spec, decision log,
and do-not list. `AGENTS.md` describes the **current** (pre-migration) architecture.

## Development setup

**Prerequisites:** Node.js **16** (pinned — the frontend is React 16 + `react-scripts@4`,
which requires this specific version; see `AGENTS.md`)

> Common workflows are wrapped in a [`justfile`](./justfile). Run `just` (or `just --list`) to see all recipes. Each section below shows both the `just` shortcut and the raw commands.

When developing locally, install in editable mode so Streamlit picks up **Python** code changes without rebuilding a wheel:

```sh
just setup     # uv sync + npm ci (frontend) + pre-commit install
```

<details><summary>Raw commands</summary>

```sh
uv sync
uv run pre-commit install  # install git hook (one-time)
```

</details>

For **frontend** (TypeScript/React) changes, run the CRA dev server on `:3001` alongside
the Streamlit app:

```sh
just dev    # one terminal
just run    # another terminal
```

<details><summary>Raw commands</summary>

```sh
# flip _RELEASE to False in streamlit_drawable_canvas/__init__.py, then:
cd streamlit_drawable_canvas/frontend
npm ci --legacy-peer-deps
npm run start

# in another terminal
uv run streamlit run e2e/app_to_test.py
```

</details>

## Linting & Formatting

```sh
just lint          # ruff check (Python) + prettier check (frontend)
just format        # ruff format + prettier write
just pre-commit    # run all pre-commit hooks
```

<details><summary>Raw commands</summary>

```sh
uv run ruff check --fix .         # lint Python
uv run ruff format .              # format Python
cd streamlit_drawable_canvas/frontend && npx prettier --check "src/**/*.{ts,tsx}"   # lint frontend
cd streamlit_drawable_canvas/frontend && npx prettier --write "src/**/*.{ts,tsx}"   # format frontend
uv run pre-commit run --all-files # run all pre-commit hooks
```

</details>

> Per-language recipes are also available: `just lint-py`, `just lint-frontend`, `just format-py`, `just format-frontend`.

## Testing

### Unit Tests (TypeScript)

```sh
just test-frontend
```

<details><summary>Raw command</summary>

```sh
cd streamlit_drawable_canvas/frontend
npm test
```

</details>

### Unit Tests (Python)

```sh
just test-py
```

<details><summary>Raw command</summary>

```sh
uv run pytest tests/ -v
```

</details>

> `just test` runs both Python and frontend unit tests in sequence.

### E2E Tests

Two suites currently coexist:

- **Cypress** (`e2e/`) — the original v1 smoke test. Being retired, not extended; see
  `docs/plans/v2-migration/00-plan.md` decision T7.

  ```sh
  just cypress-setup   # one-time install
  just build            # or `just dev`, in another shell
  just run
  just cypress-open     # or `just cypress-run` for headless
  ```

- **Playwright** (`e2e_playwright/`) — added by the v2 migration for Fabric v4 JSON
  fixture capture and, from stage 2 onward, full E2E coverage.

  ```sh
  just e2e-setup   # one-time: install deps + browsers
  just e2e         # run the tests
  ```

  <details><summary>Raw commands</summary>

  ```sh
  uv sync --group e2e
  uv run python -m playwright install --with-deps
  uv run pytest e2e_playwright -n auto
  ```

  </details>

To **clean up Playwright's browser binaries** (freeing up ~500MB+), run:

```sh
just e2e-clean
```

## Build and Publish

### Release flow

Releases live as annotated tags on `main`. The pyproject version is bumped on `develop` first so the tagged commit on `main` is self-consistent (tag `vX.Y.Z` ↔ `version = "X.Y.Z"`).

1. On `develop`, bump `version`:

   ```sh
   just bump 0.10.0
   ```

2. Open a PR into `main` and merge it, then cut the tag from a clean working tree:

   ```sh
   just tag-release 0.10.0
   ```

   This fast-forwards `main` from `develop`, creates an annotated `v0.10.0` tag, and pushes both.

3. Build, test install, and publish (see below).

> `just publish-test` and `just publish` are **guarded** — they refuse to run unless HEAD is on `main`, the tree is clean, and HEAD is tagged matching the pyproject version.

### Build and publish

1. Build the frontend assets and Python wheel:

   ```sh
   just build
   ```

2. Test install the built wheel in another project:

   ```sh
   uv pip install ../streamlit-drawable-canvas/dist/streamlit_drawable_canvas-<version>-py3-none-any.whl --force-reinstall
   uv run streamlit run app.py
   ```

3. Publish to Test PyPI (dry-run):

   ```sh
   just publish-test
   ```

   You will need a [Test PyPI API token](https://test.pypi.org/manage/account/#api-tokens). Pass it via `--token` or set `UV_PUBLISH_TOKEN_TEST`.

4. Publish to PyPI:

   ```sh
   just publish
   ```

   You will need a PyPI API token. You can pass it via `--token` or set the `UV_PUBLISH_TOKEN` environment variable.

### Expected output

- `dist/streamlit_drawable_canvas-<version>-py3-none-any.whl`
- `dist/streamlit_drawable_canvas-<version>.tar.gz`
