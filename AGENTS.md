# AGENTS.md — streamlit-drawable-canvas

> **This repo is mid-migration.** The architecture described below is the **current**
> (v1 / React / Fabric.js 4) implementation, best-effort maintained. It is being
> rewritten to Streamlit Components v2 (reactless TypeScript + Fabric.js 7) per
> `docs/plans/v2-migration/00-plan.md`. Read that directory before making any change
> that touches packaging, the frontend, or the public API — it is the authoritative
> spec, decision log, and do-not list for the migration. If your task is part of that
> migration, follow its stage docs instead of improvising from this file.

## Platform & Requirements

Major-version intent below; exact pins live in `pyproject.toml` and
`streamlit_drawable_canvas/frontend/package.json` — read those for specifics.

- **Python** 3.10+, **Streamlit** ≥ 0.63 (uses the legacy `components.v1` API)
- **Node.js 16**, pinned — the frontend is **React 16 + `react-scripts@4`** (Create React
  App), which requires Node 16 specifically. Node 17+ rejects the toolchain outright
  unless run with `NODE_OPTIONS=--openssl-legacy-provider`; Node 16 itself ships OpenSSL
  1.1.1 and **rejects that same flag** if you pass it — don't export it unconditionally
- **Fabric.js** `4.4.0` — pinned; this version's canvas JSON is the format users have
  persisted drawings in (see the migration plan's fixture-capture work)
- Build: `react-scripts build` (webpack under the hood, no direct Vite/webpack config)
- Test: `react-scripts test` (Jest), Cypress (`e2e/`, one smoke test — being retired,
  not ported, see `docs/plans/v2-migration/00-plan.md` decision T7)
- Lint: Ruff (Python), Prettier (TypeScript — newly wired up; the CRA scaffold never had
  a formatter)

## Component

### Python — `streamlit_drawable_canvas/__init__.py`

A hand-flipped `_RELEASE` boolean switches `components.v1.declare_component()` between a
`localhost:3001` dev server (`_RELEASE = False`) and the packaged `frontend/build/`
(`_RELEASE = True`, what ships). Exposes `st_canvas(...)` returning a `CanvasResult`
dataclass (`image_data`: RGBA numpy array, `json_data`: Fabric.js canvas JSON).

**Known live bug:** `background_image` calls
`streamlit.elements.image.image_to_url`, which no longer exists at that path on modern
Streamlit (moved to `streamlit.elements.lib.image_utils`, signature changed). Not
hotfixed on purpose — see plan decision S4. Also: the `component_value is None` branch
returns the `CanvasResult` **class**, not an instance (decision P11) — fixed in stage 2,
not before.

### Frontend — `streamlit_drawable_canvas/frontend/src/`

React function components wired through `streamlit-component-lib`'s
`withStreamlitConnection`:

- `DrawableCanvas.tsx` — top-level component; owns the Fabric canvas instance and drawing
  mode switching
- `DrawableCanvasState.tsx` — undo/redo history state
- `components/CanvasToolbar.tsx` — download / undo / redo / reset buttons (PNG icons,
  recolored via a CSS `filter: invert(...) hue-rotate(...)` hack — replaced with inline
  SVG in stage 2)
- `components/UpdateStreamlit.tsx` — debounced `Streamlit.setComponentValue()` calls
- `lib/fabrictool.ts` — base class for per-mode tools; `lib/{freedraw,line,rect,circle,
  point,polygon,transform}.ts` — one file per `drawing_mode`

## Build & Validation Commands

All commands assume working directory is `streamlit-drawable-canvas/`. Workflows are
wrapped in a [`justfile`](./justfile) — run `just` (or `just --list`) to see every
recipe. **Node must be 16** for anything that touches the frontend (`setup-frontend`,
`dev`, `build`, `build-frontend`) — see Platform & Requirements above.

### Common pipelines

```sh
# --- First-time setup ---
just setup        # uv sync + npm ci (frontend) + pre-commit hook

# --- Inner loop: frontend changes (two terminals) ---
just dev           # :3001 CRA dev server, flips _RELEASE to False first
just run           # streamlit run e2e/app_to_test.py

# --- Run against the packaged frontend instead ---
just build         # flips _RELEASE back to True, builds frontend/build, builds the wheel
just run

# --- Pre-push validation (CI-equivalent) ---
just lint && just test && just build

# --- Cypress (being retired — see decision T7) ---
just cypress-setup  # one-time install
just dev            # or `just build` + `just run`, in another shell
just cypress-open   # or `just cypress-run` for headless
```

### Recipe reference

| Recipe | What it does |
|---|---|
| `setup` / `setup-py` / `setup-frontend` | Install deps (full / Python only / frontend only) |
| `dev` / `dev-mode` / `release-mode` | `:3001` CRA dev server / flip `_RELEASE` off / flip it back on — **all three go away in stage 2** |
| `run` | `uv run streamlit run e2e/app_to_test.py` |
| `lint` / `lint-py` / `lint-frontend` | ruff check + prettier check (combined / split) |
| `format` / `format-py` / `format-frontend` | ruff format + prettier write |
| `pre-commit` | `uv run pre-commit run --all-files` |
| `test` / `test-py` / `test-frontend` | Unit tests (pytest + `react-scripts test`/Jest) |
| `cypress-setup` / `cypress-open` / `cypress-run` | Old Cypress e2e suite — **deleted in stage 2**, not ported |
| `e2e-setup` / `e2e` / `e2e-clean` | Playwright deps install / run `e2e_playwright/` tests / uninstall browsers |
| `build` / `build-frontend` / `build-wheel` | Build frontend bundle + Python wheel (assumes deps installed) |
| `build-clean` | From-scratch wheel: `clean` + reinstall frontend deps + `build` |
| `clean` | Remove `dist/`, `build/`, `*.egg-info`, frontend `node_modules/`/`build/`, `e2e/node_modules/` |
| `bump X.Y.Z` | Sync version across root `pyproject.toml`, `uv.lock`, frontend `package.json`/`package-lock.json` (and the inner `streamlit_drawable_canvas/pyproject.toml` once stage 2 adds it); commit on develop |
| `tag-release X.Y.Z` | Ff-merge develop → main, annotated tag `vX.Y.Z`, push both |
| `publish-test` / `publish` | Guarded build + publish to Test PyPI / PyPI |
| `merge-dependabot` | Squash-merge every green, conflict-free Dependabot PR + delete branch, then sync develop (needs `gh`) |
