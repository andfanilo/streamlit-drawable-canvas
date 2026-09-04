# AGENTS.md — streamlit-drawable-canvas

## Platform & Requirements

Major-version intent below; exact pins live in `pyproject.toml` and
`streamlit_drawable_canvas/frontend/package.json` — read those for specifics.

- **Python** 3.10+, **Node.js** 24+, **Streamlit** ≥ 1.53 (uses the `components.v2` API)
- **Fabric.js** `7.4.0` (up from 4.4.0 in 0.9.x) — v4 canvas JSON loads under v7 with one
  known exception (Circle/Point `startAngle`/`endAngle`, radians → degrees; see
  `CHANGELOG.md`'s `[0.10.0]` entry)
- Build: Vite 8, library mode, ES output
- Test: Vitest (jsdom, pure logic only — Fabric needs a real `<canvas>` 2D context, which
  jsdom doesn't provide), pytest, Playwright (`e2e_playwright/`, everything that touches
  an actual canvas)
- Lint: Ruff (Python), Prettier + `tsc --noEmit` (TypeScript)

This is the **current** (v2) architecture, reached via a migration from Streamlit
Components v1 / React 16 / Fabric.js 4. Much of it is shaped by decisions taken during
that migration — read `CHANGELOG.md`'s `[0.10.0]` entry and the relevant commit messages
before changing something that looks deliberate.

## Component

### Python — `streamlit_drawable_canvas/__init__.py`

Module-level `st.components.v2.component(...)` registration (JS glob `"index-*.js"`,
`isolate_styles=True` — the component renders inside a shadow root). Exposes
`st_canvas(...)`, returning a `CanvasResult`.

- `CanvasResult.image_data` is a property, not a stored value: it raises `RuntimeError`
  unless `return_image_data=True` was passed, and decodes the component's base64 PNG
  payload into a numpy array lazily (importing Pillow/numpy only on access, so the base
  install stays free of them).
- `_resolve_background_image_url` accepts what `st.image` accepts — URL, `data:` URI,
  local path, raw bytes, or a PIL Image — and resolves all of them to a `data:` URI the
  frontend can hand straight to Fabric, memoized by content hash in a bounded
  (`_BG_IMAGE_CACHE_MAXSIZE`-entry) LRU so re-encoding only happens once per distinct
  image. Only the PIL branch imports Pillow.
- `drawing_mode` is validated against `_VALID_DRAWING_MODES` (kept in sync with the
  `tools` registry in `frontend/src/tools/index.ts` — see comment there); an unrecognized
  mode raises `ValueError` rather than silently falling back.

### Frontend renderer — `frontend/src/`

- **`index.ts`** — `DrawableCanvasRenderer`, the `FrontendRenderer` entry point. Since the
  renderer re-runs on every data change without its previous invocation's cleanup, all
  state that must survive reruns (the Fabric canvas, undo/redo history, in-flight loads)
  lives in a module-scoped `WeakMap<parentElement, CanvasInstance>`, not in local
  variables.
- **`instance.ts`** — owns `CanvasInstance` and `applyData`, which diffs the incoming
  `data` against what was last applied and only redoes the parts that changed: canvas
  resize, background image (memoized on URL), `initialDrawing` (memoized on a JSON-string
  key; reloading it on every rerun would wipe an in-progress drawing), and per-tool
  config (memoized on a `drawingMode`/style key via `toolKeyFor`). Mouse handlers defer
  their snapshot-and-maybe-send logic with `queueMicrotask` so tool-specific handlers
  (registered later, e.g. `LineTool.onMouseUp` discarding a click-without-drag) run first
  within the same synchronous event. Realtime sends go through a 200ms trailing debounce
  (`debounce.ts`); force-sends (right-click, toolbar button, undo/redo/reset) go through
  `Sender.now()`, which cancels any pending debounced send first.
- **`background.ts`** — `applyBackgroundImage`/`rescaleBackgroundImage` draw the resolved
  URL onto a separate `StaticCanvas` layer behind the drawing canvas, scaled to fill it;
  rescaled again on a canvas resize without re-fetching.
- **`toolbar.ts`** — download/undo/redo/reset buttons as inline SVG on `currentColor`,
  driven by the `--st-text-color` CSS variable — dark-mode support with no PNG assets and
  no recolor hack.
- **`history.ts`** — `HistoryStore`, a pure undo/redo stack over opaque JSON snapshots (no
  Fabric or DOM dependency, so Vitest drives it directly).
- **`debounce.ts`** — `debounce` (trailing-edge) and `createSender` (the
  schedule/now/cancel policy above). Hand-rolled, not a library — see its file header for
  why.
- **`tools/`** — `fabrictool.ts`'s `FabricTool` abstract base, one file per
  `drawing_mode` (`freedraw`, `line`, `rect`, `circle`, `point`, `polygon`, `text`,
  `edit`), and `index.ts`'s `tools` registry mapping mode name → tool class.

## Build & Validation Commands

All commands assume working directory is `streamlit-drawable-canvas/`. Workflows are
wrapped in a [`justfile`](./justfile) — run `just` (or `just --list`) to see every
recipe.

### Common pipelines

```sh
# --- First-time setup + run the demo ---
just setup        # uv sync + npm ci (frontend) + pre-commit install
just demo         # uv run streamlit run demo_app.py

# --- Inner loop: frontend changes (two terminals) ---
just dev           # Vite watch-rebuild frontend/build on save (no dev server / HMR)
just demo          # Streamlit reruns and serves the rebuilt bundle

# --- Pre-push validation (CI-equivalent) ---
just lint && just test && just build && just e2e

# --- E2E (Playwright) ---
just e2e-setup    # one-time: install deps + browsers
just build        # E2E needs the built frontend
just e2e          # uv run pytest e2e_playwright -n auto
```

### Recipe reference

| Recipe | What it does |
|---|---|
| `setup` / `setup-py` / `setup-frontend` | Install deps (full / Python only / frontend only) |
| `dev` | Vite watch-rebuild frontend on save — run alongside `just demo` |
| `app-run` (alias: `demo`) | `uv run streamlit run demo_app.py` |
| `lint` / `lint-py` / `lint-frontend` | ruff check + `tsc --noEmit` + prettier check (combined / split) |
| `format` / `format-py` / `format-frontend` | ruff format + prettier write |
| `pre-commit` | `uv run pre-commit run --all-files` |
| `test` / `test-py` / `test-frontend` | Unit tests (pytest / Vitest, pure logic only) |
| `e2e-setup` / `e2e` / `e2e-clean` | Playwright deps install / run `e2e_playwright/` tests / uninstall browsers |
| `build` / `build-frontend` / `build-wheel` | Build frontend bundle + Python wheel (assumes deps installed) |
| `build-clean` | From-scratch wheel: `clean` + reinstall frontend deps + `build` |
| `clean` | Remove `dist/`, `build/`, `*.egg-info`, frontend `node_modules/`/`build/` |
| `bump X.Y.Z` | Sync version across root `pyproject.toml`, `uv.lock`, frontend `package.json`/`package-lock.json`; commit on `develop` |
| `tag-release X.Y.Z` | Ff-merge `develop` → `main`, annotated tag `vX.Y.Z`, push both |
| `publish-test` / `publish` | Guarded build + publish to Test PyPI / PyPI |
| `merge-dependabot` | Squash-merge every green, conflict-free Dependabot PR + delete branch, then sync `develop` (needs `gh`) |

`merge-dependabot` has no corresponding `.github/dependabot.yml` in this repo — as with
`../streamlit-echarts`, Dependabot is either configured in GitHub's repo settings
directly, or simply not enabled. Don't add a `dependabot.yml` on the assumption it's
missing; check repo settings first.
