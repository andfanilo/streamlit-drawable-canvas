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

## Architecture

`AGENTS.md` describes the current architecture: Streamlit Components v2, a reactless
TypeScript frontend built with Vite, and Fabric.js 7. It moved there from Components v1
/ React 16 / Fabric.js 4 in the `0.10.0` release; `docs/plans/v2-migration/` is the
historical record of that migration — decision log, risks, and what was rejected. If
you're wondering why something is shaped the way it is, look there before changing it.

## Development setup

**Prerequisites:** Node.js **24+**

> Common workflows are wrapped in a [`justfile`](./justfile). Run `just` (or `just --list`) to see all recipes. Each section below shows both the `just` shortcut and the raw commands.

When developing locally, install in editable mode so Streamlit picks up **Python** code changes without rebuilding a wheel:

```sh
just setup     # uv sync + npm ci (frontend) + pre-commit install
```

<details><summary>Raw commands</summary>

```sh
uv sync
cd streamlit_drawable_canvas/frontend && npm ci
uv run pre-commit install  # install git hook (one-time)
```

</details>

For **frontend** (TypeScript) changes, run the Vite watch-rebuild alongside the demo app.
There's no dev server or HMR — Vite rebuilds `frontend/build` on save, and Streamlit
picks up the new bundle on the next rerun:

```sh
just dev    # one terminal
just demo   # another terminal
```

<details><summary>Raw commands</summary>

```sh
cd streamlit_drawable_canvas/frontend
npm run dev

# in another terminal
uv run streamlit run demo_app.py
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
cd streamlit_drawable_canvas/frontend && npm run typecheck && npx prettier --check "src/**/*.ts"   # lint frontend
cd streamlit_drawable_canvas/frontend && npx prettier --write "src/**/*.ts"   # format frontend
uv run pre-commit run --all-files # run all pre-commit hooks
```

</details>

> Per-language recipes are also available: `just lint-py`, `just lint-frontend`, `just format-py`, `just format-frontend`.

## Testing

### Unit Tests (TypeScript)

Vitest, pure logic only — jsdom's `<canvas>` has no real 2D context, so Fabric can't run
there. Anything touching an actual canvas belongs in the Playwright suite below instead.

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

### E2E Tests (Playwright)

Everything that touches an actual canvas — synthetic mouse drags asserting on
`json_data` structure, plus the Fabric v4 JSON compatibility fixtures in
`e2e_playwright/fixtures/fabric-v4/`.

```sh
just e2e-setup   # one-time: install deps + browsers
just build       # E2E needs the built frontend
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
