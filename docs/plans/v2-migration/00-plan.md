# streamlit-drawable-canvas → Streamlit Components v2

**Status:** design settled, implementation not started
**Target release:** `0.10.0`
**Branch:** `feat/components-v2` off `develop`

This directory is the authoritative specification for migrating this component from
Streamlit Components **v1** (`components.declare_component`) to **v2**
(`st.components.v2.component`), rebuilding the frontend on Vite + Fabric.js 7, and
bringing the repo up to parity with `../streamlit-echarts`.

| Document | Purpose |
|---|---|
| `00-plan.md` (this file) | Decision log, stage map, risks, stop conditions |
| `01-infra.md` | Stage 1 — packaging, infra, test harness, **v4 JSON fixture capture** |
| `02-frontend.md` | Stage 2 — frontend rewrite + Python v2 API + modernization |
| `03-release.md` | Stage 3 — docs, demo, release |
| `04-issue-triage.md` | The 50 open GitHub issues, triaged against the rewrite: what it already fixed, what is cheap enough to fold in, what is out of scope |
| `05-issue-responses.md` | The same 50 issues as a post-ready sweep sheet: per-issue disposition and draft reply text, gated on 0.10.0 actually shipping |

---

## 0. How to use these documents

You are most likely a fresh session picking up one stage. Read, in order:

1. This file, in full. It is short and it exists so you do **not** re-derive settled decisions.
2. Your stage's spec.
3. Nothing else from `docs/plans/` unless your spec points you at it.

**§2 (Decision log) and §3 (Do-not list) are binding.** They were settled through a long
design interview with the maintainer. If you believe a decision is wrong, that is a
STOP condition (§6) — say so and wait. Do not quietly choose differently, and do not
"improve" on them in passing.

Tick the checkboxes in your stage spec as you complete tasks and commit those ticks
with the work. Progress must live in git, not in your context window — you will very
likely compact partway through stage 2.

---

## 1. Context

### What this component is

A Streamlit custom component providing a Fabric.js sketching canvas. Public API is a
single function `st_canvas(...)` returning a `CanvasResult` dataclass with
`image_data` (RGBA numpy array) and `json_data` (Fabric.js canvas JSON).

### Where it is today (v0.9.3)

- **Python**: `components.v1.declare_component` with a hand-flipped `_RELEASE` boolean
  switching between a `localhost:3001` dev server and `frontend/build`.
- **Frontend**: React 16 + `react-scripts@4` (CRA), `streamlit-component-lib`,
  `withStreamlitConnection`, Fabric.js pinned at **4.4.0**.
- **Packaging**: `setup.py` + `MANIFEST.in`.
- **Tests**: one Cypress smoke test.
- **CI**: one workflow publishing to PyPI via `twine` with username/password secrets.

### Why now

Beyond general staleness, two things force the issue:

1. **`background_image` is already broken.** `streamlit_drawable_canvas/__init__.py`
   does `import streamlit.elements.image as st_image; st_image.image_to_url(...)`.
   That function no longer exists at that path in Streamlit 1.63 — it moved to
   `streamlit.elements.lib.image_utils` and its signature changed to require an
   internal `LayoutConfig`. Verified against the local Streamlit checkout. **This is a
   live bug on modern Streamlit, not a hypothetical.**
2. **`react-scripts@4` requires `NODE_OPTIONS=--openssl-legacy-provider` and Node 16.**
   The toolchain is past end of life.

### Reference repositories (all on disk, siblings of this repo)

| Path | Role |
|---|---|
| `../streamlit-echarts` | **The reference implementation.** Already migrated to v2, reactless, Vite, uv, just, Playwright. Copy from here by default. |
| `../component-template` | Official Streamlit template. `cookiecutter/v2/` is the canonical v2 shape. |
| `../streamlit-bokeh` | Streamlit's own component; the source echarts' migration drew on. Useful for `e2e_playwright/conftest.py` lineage. |
| `../streamlit` | Streamlit source checkout (also installed as 1.63.0 in this repo's `.venv`). The ground truth for v2 API behaviour. |
| `../streamlit-drawable-canvas-demo` | Public showcase app. Out of scope until 0.10.0 ships (see stage 3). |

---

## 2. Decision log

Every row is settled. The **Why** column exists so you do not reopen it.

### 2.1 Scope and release

| # | Decision | Why | Rejected |
|---|---|---|---|
| S1 | Port **and** modernize the public API in one pass | The breaking-change budget is being spent anyway; spending it twice is worse | Pure structural port |
| S2 | Ship as **`0.10.0`**, not `1.0.0` | Leaves room to iterate before committing to stability | `1.0.0` |
| S3 | **Clean v2-only cutover.** Floors: `streamlit >= 1.53`, `python >= 3.10` | Dual v1/v2 frontends are a permanent maintenance tax on a best-effort project. 0.9.3 keeps working for old Streamlit | Dual v1+v2 frontends like `streamlit-bokeh` |
| S4 | **No 0.9.4 hotfix** for the broken `background_image` | All effort goes to 0.10.0; don't fork work onto code being deleted | Hotfix on the v1 architecture |

`streamlit >= 1.53` floor rationale: `st.components.v2` and `isolate_styles` both landed
2025-10-24 in the Streamlit repo. 1.53 matches `../streamlit-echarts`, which is already
validated in production.

### 2.2 Python API

| # | Decision | Why | Rejected |
|---|---|---|---|
| P1 | **No parameter renames.** `update_streamlit` keeps its name | Renames break every existing snippet and StackOverflow answer for zero functional gain | Renaming `update_streamlit` → `realtime_update` |
| P2 | `image_data` becomes **opt-in, default `False`** | It PNG-encodes the whole canvas on every mouse-up and is paid for by users who only read `json_data` | Unconditional; lazy decode |
| P3 | `Pillow` and `numpy` move to an **`[image]` optional extra**; base install is `streamlit` only | Most users never touch `image_data` | Keeping them required |
| P4 | Accessing `image_data` when not requested **raises**, naming both the parameter and the extra | Silent `None` is a worse debugging experience than a loud error | Returning `None` |
| P5 | **No auto-detection** of Pillow/numpy availability | Identical code behaving differently on two machines is the worst class of support bug | Sniffing installed packages |
| P6 | `background_image` **widened** to accept what `st.image` accepts (URL / path / bytes / PIL) | Only design that avoids private Streamlit APIs entirely | Data-URI-only; `image_to_url`; Arrow ndarray |
| P7 | Raw pixels are base64 `data:` URI encoded, **memoized by content hash** | v2 has no image channel. Re-encoding per rerun is the cost to avoid | — |
| P8 | Payload travels on **`setStateValue`**, plus an `on_drawing_change` callback | `setTriggerValue` silently no-ops inside `st.form`, and drawing-in-a-form is plausible | Triggers for force-send |
| P9 | `width`/`height` stay **canvas pixel dims**; mounted `width="content", height="content"` | Fabric JSON coordinates are in canvas pixel space; a responsive canvas makes saved drawings device-dependent | `width="stretch"`; opt-in stretch |
| P10 | Full type annotations, **no `py.typed`**, no mypy job | Matches echarts; avoids committing to type stability across releases | `py.typed`; mypy in CI |
| P11 | Fix the live bug: `return CanvasResult` → `CanvasResult()` | It currently returns the *class*, not an instance | — |

A responsive canvas (P9) is a wanted feature. It is deliberately **out of scope** — it
has an unsolved coordinate-space problem and folding it in would mean any rendering bug
has two possible causes.

### 2.3 Frontend

| # | Decision | Why | Rejected |
|---|---|---|---|
| F1 | **Reactless vanilla TypeScript** | The v2 contract is imperative and Fabric is imperative; React was fighting both. Matches echarts | React 18; hybrid React island for the toolbar |
| F2 | **Fabric.js 7.4.0** | We rewrite every `getPointer()` call site regardless, and `getScenePoint()` exists in v6 and v7 alike — v6 buys only a second migration later | v6.9.1; v6-then-v7 |
| F3 | **Module-scoped `WeakMap<parentElement, CanvasInstance>`** holding the Fabric canvas, undo/redo history and memoized appliers | The renderer is re-invoked on every data change without cleanup; rebuilding would destroy undo history on every unrelated rerun | Rebuild per invocation; history in `session_state` |
| F4 | **`isolate_styles=True`** (shadow DOM) | A canvas widget with its own toolbar wants encapsulation. echarts chose `False` only because chart labels must inherit app fonts | `isolate_styles=False` |
| F5 | Toolbar PNGs → **inline SVG** on `currentColor` / `var(--st-text-color)` | Kills the hardcoded `filter: invert(...) hue-rotate(...)` recolor hack and gives dark-mode support for the first time | Shipping PNGs via `asset_dir` |
| F6 | Vite 8 library mode, ES output, `index-[hash].js` | echarts / cookiecutter v2 shape | — |

### 2.4 Testing and infra

| # | Decision | Why | Rejected |
|---|---|---|---|
| T1 | Import the **full** `../streamlit-echarts` scaffolding | Third divergent repo shape is pure friction; the release recipes are the time-saver | Packaging only; partial |
| T2 | **Vitest = pure logic only** (undo/redo store, JSON diffing, data-URI helpers) | jsdom's `<canvas>` is a stub with no 2D context; Fabric cannot run there | `node-canvas` so Vitest can drive Fabric |
| T3 | **Playwright = everything touching a canvas.** Synthetic mouse drags asserting on **`json_data` structure**, not pixels | Stroke screenshots are antialiasing- and platform-sensitive; the object model is not | Screenshots throughout; render-only |
| T4 | **Screenshot snapshots only for the Fabric v4-JSON fixtures** | There, rendering *is* the thing under test | — |
| T5 | Fabric v4 JSON compatibility **verified empirically and locked with fixtures** | Fabric offers no cross-major JSON guarantee and `loadFromJSON` ignores the `version` field. Users have drawings they cannot regenerate | Best-effort + docs; declare breaking |
| T6 | **Local guarded `just publish`**; delete the `twine` workflow | Full parity with echarts, fewest moving parts. The username/password pattern is discouraged by PyPI | OIDC trusted publishing in CI; both |
| T7 | Delete `e2e/` (Cypress) outright, **do not port** | It is a single smoke test asserting three `<canvas>` elements exist inside an iframe. There is no iframe in v2 — it is structurally invalid, and there is no coverage to preserve | Porting it to Playwright |
| T8 | Add an in-repo `demo_app.py`; keep `../streamlit-drawable-canvas-demo` as the showcase | Mirrors `streamlit-echarts` / `streamlit-echarts-demo` exactly | In-repo only; showcase only |

---

## 3. Do-not list

Binding. Each of these was actively considered and rejected.

- **Do not rename any existing `st_canvas` parameter.** (P1)
- **Do not use `streamlit.elements.lib.image_utils.image_to_url`**, or any other
  underscore-free-but-unexported Streamlit internal. Re-adopting a private API is what
  broke `background_image` in the first place. (P6)
- **Do not add `node-canvas`** or otherwise try to make Fabric run under jsdom/Vitest. (T2)
- **Do not put the drawing payload on `setTriggerValue`.** It no-ops inside `st.form`. (P8)
- **Do not make the canvas responsive** / `width="stretch"`. (P9)
- **Do not introduce React**, in any form, including a toolbar island. (F1)
- **Do not port the Cypress suite.** Delete it. (T7)
- **Do not add `py.typed` or a mypy CI job.** (P10)
- **Do not delete the Fabric 4 frontend before stage 1's fixtures are committed.** (§5)
- **Do not `git push`, open a PR, publish to PyPI, or tag a release** unless the stage
  spec explicitly says to and the maintainer has approved that stage.

---

## 4. Target end state

```
streamlit-drawable-canvas/
  pyproject.toml                     # setuptools, project metadata, dep groups
  uv.lock
  justfile                           # setup/dev/demo/lint/test/build/bump/tag-release/publish
  .pre-commit-config.yaml            # ruff + prettier + hygiene hooks
  .gitattributes                     # LF normalization
  demo_app.py                        # NEW - what `just demo` runs
  AGENTS.md / CLAUDE.md / CONTRIBUTING.md
  README.md / CHANGELOG.md / FAQ.md
  .github/workflows/                 # enforce-pre-commit, python-tests, ts-tests, playwright
  docs/plans/v2-migration/           # this directory
  tests/                             # pytest, Python-side unit tests
  e2e_playwright/                    # Playwright E2E + v4 JSON fixtures + snapshots
  streamlit_drawable_canvas/
    __init__.py                      # st.components.v2.component(...)
    pyproject.toml                   # v2 manifest: [[tool.streamlit.component.components]]
    frontend/
      package.json                   # vite 8, fabric 7, @streamlit/component-v2-lib
      vite.config.ts                 # library mode, ES, index-[hash].js
      vitest.config.ts
      tsconfig.json
      src/
        index.ts                     # FrontendRenderer entry
        ...                          # canvas, tools, undo/redo store, toolbar
```

**Gone:** `setup.py`, `e2e/`, `frontend/.env`, `frontend/public/`, `src/img/*.png`,
`frontend/tsconfig.json`'s CRA shape, `react-app-env.d.ts`, the `_RELEASE` flag and its
`dev-mode`/`release-mode` justfile recipes, `.github/workflows/publish_new_release.yml`,
`streamlit_drawable_canvas.egg-info/`.

**Kept:** `LICENSE`, `CHANGELOG.md` (history preserved, 0.10.0 entry added), `img/demo.gif`,
`MANIFEST.in` (updated).

---

## 5. Stages

Three stages, sequential, on one branch. **Each stage ends with a human gate.**

| Stage | Spec | Content | Gate |
|---|---|---|---|
| 0 | — | This directory, committed | — |
| 1 | `01-infra.md` | Packaging, infra, test harness, **v4 JSON fixture capture** | Maintainer sign-off. **One-way door.** |
| 2 | `02-frontend.md` | Frontend rewrite + Python v2 API + modernization | Maintainer sign-off **+ an Opus review pass** |
| 3 | `03-release.md` | Docs, demo, release | Maintainer sign-off |

### The one-way door

Stage 1 ends by capturing Fabric v4 JSON fixtures **from the current, working 4.4.0
build**. Stage 2 deletes that build. Those fixtures cannot be recovered afterwards —
they would have to be hand-reconstructed, which defeats their purpose as ground truth.

**Stage 2 must not begin until stage 1's fixtures are committed and verified.**

### Review protocol

- Each stage ends with `/code-review` run by the executing session.
- **Every stage requires explicit maintainer sign-off before the next begins.**
- **Stage 2 additionally gets an Opus review pass** — that is where the subtle
  v2-contract and Fabric-in-shadow-DOM problems would hide.
- Each stage is a fresh Sonnet session pointed at its spec.

---

## 6. Risks and STOP conditions

A STOP condition means: **stop work, report what you found with evidence, and wait for
the maintainer.** Do not improvise a fix — each of these reopens a decision that was
deliberately deferred to the maintainer.

### R1 — The Fabric 4 frontend may no longer build

Stage 1's fixture capture requires building the *current* frontend: `react-scripts@4`,
Node 16, `NODE_OPTIONS=--openssl-legacy-provider`, `npm ci --legacy-peer-deps`. This has
**not been verified** on the current machine. It is the very first task in stage 1 for
exactly that reason.

**STOP if it does not build.** The fixture plan needs rethinking and that is the
maintainer's call. Do not fabricate fixtures by hand.

### R2 — Fabric.js in a shadow DOM is not a well-trodden path

`isolate_styles=True` (F4) puts the component inside a shadow root. Fabric does its own
coordinate math from `getBoundingClientRect` and attaches document-level listeners;
shadow-boundary event retargeting could break pointer positioning, which would break
every drawing tool.

**Prove this in the first hours of stage 2**, before building anything on top of it.
The fallback is `isolate_styles=False` — but that reverses a settled decision, so
**STOP and report** rather than switching unilaterally.

### R3 — Fabric v4 JSON may not load under v7

Fabric publishes no cross-major JSON compatibility guarantee, and `loadFromJSON` does
not consult the `version` field. Our shapes are simple and long-stable
(`Line`/`Rect`/`Circle`/`Path` with `left/top/width/height/radius/path/stroke/fill/angle`),
so survival is plausible — but unverified.

**STOP if a fixture fails to load or renders differently.** The choice between a
version-sniffing migration shim and declaring it breaking was explicitly deferred to the
maintainer.

### R4 — Known Fabric 4 → 7 breakages

Not stop conditions — expected work, itemized here so nothing is missed. Full detail in
`02-frontend.md`.

| Breakage | Blast radius |
|---|---|
| `import { fabric }` namespace import removed; use named exports | 8 files |
| `loadFromJSON` is Promise-based, and now always defers via microtask | 3 call sites; **changes effect ordering** around `resetState`/`saveState` |
| `toJSON()` is no longer an alias of `toObject()` | undo/redo state saving depends on this |
| `getPointer()` **removed** in v7 → `getScenePoint()` / `getViewportPoint()` | all 5 tool files |
| `freeDrawingBrush` no longer auto-instantiated | `lib/freedraw.ts` |
| v7 flips `originX`/`originY` defaults to `center` | insulated — our tools set them explicitly. Verify, don't assume. |

---

## 7. Open items

Small things deliberately left unresolved. Resolve them in-stage using judgement; none
warrant blocking.

- `../streamlit-echarts` has a `merge-dependabot` justfile recipe but **no**
  `.github/dependabot.yml`. Either it is configured in GitHub repo settings or it does
  not exist. Do not invent one; carry the recipe over and note it in stage 3.
- Node version pin: cookiecutter v2 and echarts' `AGENTS.md` both say Node 24+. Adopt
  that; add `.nvmrc` if convenient.
- Component registration name: follow echarts' pattern —
  `"streamlit-drawable-canvas.streamlit_drawable_canvas"`.
- Frontend directory stays `frontend/` (echarts), not the cookiecutter's
  `frontend-react` / `frontend-reactless` split.
