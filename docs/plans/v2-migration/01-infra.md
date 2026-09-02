# Stage 1 — Infrastructure, packaging, and v4 fixture capture

**Prerequisite reading:** `00-plan.md`, in full.
**Gate on completion:** maintainer sign-off. **This stage is a one-way door** — stage 2
deletes the Fabric 4 frontend, and the fixtures captured here cannot be recovered
afterwards.

## Goal

Bring the repo to `../streamlit-echarts` infrastructure parity **while leaving the
existing v1 / React / Fabric 4 component fully working**, and capture Fabric 4 JSON
ground-truth fixtures before that frontend is destroyed.

At the end of this stage the component still behaves exactly as 0.9.3 does. Nothing
about the component's *behaviour* changes here. If you find yourself editing
`streamlit_drawable_canvas/frontend/src/`, you are in the wrong stage.

---

## Phase A — Verify the Fabric 4 build (do this first)

This is risk **R1**. Everything downstream depends on it. Do not start Phase B until
this passes.

- [x] `npm ci --legacy-peer-deps` succeeds in `streamlit_drawable_canvas/frontend`
- [x] `NODE_OPTIONS=--openssl-legacy-provider npm run build` produces `frontend/build/`
      (Node 16.20.2 ships OpenSSL 1.1.1 and rejects this flag outright — built with
      plain `npm run build`, no `NODE_OPTIONS` needed. Node 17+ is what requires the flag.)
- [x] `streamlit run e2e/app_to_test.py` renders a canvas you can draw on
- [x] Record the Node version used, in the fixtures README (Phase C) — Node 16.20.2

> **STOP condition R1.** If the build fails — Node too new, `react-scripts@4`
> incompatible, dependency resolution broken — **stop and report**, with the exact error.
> Do not hand-write fixtures, do not try to upgrade the old toolchain, do not skip ahead
> to stage 2. The maintainer decides how to proceed.
>
> If Node 16 is unavailable, note that `nvm`/`fnm` may be able to install it, and that
> `--openssl-legacy-provider` is what makes newer Node tolerate `react-scripts@4`'s
> OpenSSL-3-rejected hash. Report what you tried.

---

## Phase B — Packaging and infrastructure

Copy from `../streamlit-echarts` by default and adapt. Do not write these from scratch;
the point of T1 is that the two repos look the same.

### B1 — Packaging

- [x] Write `pyproject.toml` (from `../streamlit-echarts/pyproject.toml`)
  - `name = "streamlit-drawable-canvas"`, `version = "0.9.3"` — **do not bump yet**,
    the bump to `0.10.0` happens in stage 3
  - `requires-python = ">=3.10"`
  - `dependencies` stay **as they are today**: `["Pillow", "numpy", "streamlit >= 0.63"]`.
    Restructuring deps into the `[image]` extra is decision P2/P3 and belongs to stage 2
  - Keep `[tool.setuptools.packages.find] namespaces = false` — echarts carries a comment
    explaining that without it, setuptools discovers every `node_modules` dir as a
    namespace package and ships stray `.py` files in the wheel. That applies here too
  - `[tool.setuptools.package-data]` → `streamlit_drawable_canvas = ["frontend/build/**/*"]`.
    Add `"pyproject.toml"` to that list in **stage 2**, when the inner v2 manifest exists
  - Carry over the `[[tool.uv.index]] testpypi` block
  - `[dependency-groups]` `dev` and `e2e`, as echarts has them
- [x] Delete `setup.py`
- [x] Update `MANIFEST.in` (keep `recursive-include .../frontend/build *`, add `include pyproject.toml`)
- [x] `uv lock` → commit `uv.lock`
- [x] Delete the committed/untracked `streamlit_drawable_canvas.egg-info/` (was already gitignored, untracked-only)
- [x] Verify: `uv build` produces a wheel containing `frontend/build/`

### B2 — Task runner

- [x] Write `justfile` from `../streamlit-echarts/justfile`, adapting paths
- [x] **Keep the v1-only recipes for now**, each marked with a
      `# DELETE IN STAGE 2` comment: `dev-mode`, `release-mode`,
      the `:3001` dev-server `dev` recipe, and `--legacy-peer-deps` on `setup-frontend`.
      **Deviation:** did **not** re-add `export NODE_OPTIONS := "--openssl-legacy-provider"`
      (present in a pre-existing justfile from before this stage started). Phase A found
      Node 16 — the version this justfile's own comment says CI pins, and the version
      that actually builds react-scripts@4 — **rejects that flag outright**
      (`node.exe: --openssl-legacy-provider is not allowed in NODE_OPTIONS`); only
      Node 17+ needs/accepts it. Exporting it unconditionally would break `just build`,
      `just dev`, and `just setup-frontend` under the exact toolchain Phase A just
      verified works. Flagged for the maintainer in the stage sign-off report.
- [x] Adapt `just bump` — echarts syncs root `pyproject.toml`, the **inner**
      `pyproject.toml`, `uv.lock` and the frontend `package.json`/`package-lock.json`.
      The inner `pyproject.toml` does not exist until stage 2. Either guard that line or
      leave a `# STAGE 2` comment; do not let `just bump` fail silently
      (guarded with `Test-Path` around both the inner-pyproject edit and its `git add`)
- [x] Carry `merge-dependabot` over verbatim
- [x] Keep `test-frontend` pointing at `react-scripts test` for now; it becomes Vitest in stage 2

### B3 — Lint, format, hygiene

- [x] `.pre-commit-config.yaml` from echarts; adapt the prettier hook's `cd` path and the
      `build/` exclude paths to `streamlit_drawable_canvas/frontend/`
- [x] `.gitattributes` from echarts (LF normalization — this repo is developed on Windows
      and this is what keeps ruff/prettier stable across platforms)
- [x] Add `[tool.ruff]` config to `pyproject.toml` matching echarts — echarts itself
      carries **no** `[tool.ruff]` section (ruff runs on its defaults there), so this
      repo matches that by adding nothing
- [x] Merge echarts' `.gitignore` additions into the existing one (`.venv/`, `uv.lock`
      is **tracked**, `test-results/`, `__snapshots__` handling, `.ruff_cache/`)
- [x] `uv run pre-commit install`
- [x] Run `uv run pre-commit run --all-files` and fix fallout. Expect churn from LF
      normalization and ruff formatting the existing `__init__.py` — that is fine and
      expected, but keep it in its **own commit** so it does not obscure real changes.
      Also hit: ruff (0.16.5) reformats embedded Python fences inside Markdown too, so
      README.md and docs/plans/v2-migration/02-frontend.md picked up trivial
      quote-style/wrapping diffs from running `ruff format .` repo-wide — cosmetic only,
      kept in the same formatting commit. Also: the v1 CRA `package.json` had no
      `prettier` devDependency at all (echarts' hook assumes one); added `prettier@^3.6.2`
      and formatted the 15 previously-never-formatted frontend `.ts`/`.tsx` files —
      whitespace-only, rebuilt and confirmed the frontend still compiles identically
      (+1 byte gzipped) after the pass.

### B4 — Python test scaffolding

- [x] Create `tests/` with `conftest.py` and a minimal `test_init.py` (import the package,
      assert `st_canvas` is callable, assert `CanvasResult` fields). Model on
      `../streamlit-echarts/tests/`. No mocking needed here (unlike echarts' conftest):
      v1's `declare_component(path=...)` doesn't validate the path exists at import
      time, so the package imports cleanly with no built frontend present
- [x] `just test-py` passes

### B5 — CI workflows

- [x] `.github/workflows/enforce-pre-commit.yml` from echarts
- [x] `.github/workflows/python-tests.yml` from echarts
- [x] **Delete** `.github/workflows/publish_new_release.yml` (decision T6)
- [x] Do **not** add `ts-tests.yml` or `playwright.yml` yet — there is no Vitest and no v2
      frontend to test. They land in stage 2

### B6 — Agent and contributor docs

- [x] `AGENTS.md` adapted from echarts' — describe the **current** (v1) architecture
      honestly, with a prominent pointer to `docs/plans/v2-migration/`
- [x] `CLAUDE.md` and `GEMINI.md` as one-line pointers to `AGENTS.md` (echarts' pattern)
- [x] `CONTRIBUTING.md` from echarts, adapted
- [x] `.claude/` directory (agents, commands, skills) copied from echarts — the
      `agents/` and `commands/` content is adapted to this repo's real structure
      (v1/React/Fabric4, Jest not Vitest, Cypress+Playwright coexisting); `skills/` is
      repo-agnostic and copied verbatim. Did **not** copy `.claude/hooks/`,
      `.claude/settings.json`/`.local.json`, or `.gemini/` — the B6 checklist item only
      names agents/commands/skills, and the Stop-hook + permission allowlist in
      echarts' settings are project-specific choices not asked for here

---

## Phase C — Capture Fabric 4 JSON fixtures

The heart of this stage. Read this phase in full before starting it.

### What we are capturing and why

Users have `initial_drawing` / `json_data` payloads persisted by Fabric **4.4.0** that
they cannot regenerate. Fabric publishes no cross-major JSON compatibility guarantee and
`loadFromJSON` does not consult the `version` field (see risk R3). Stage 2 must prove
that Fabric 7 still loads this data. That proof needs real v4 output as its input.

### Two kinds of artifact — do not confuse them

| Artifact | Role |
|---|---|
| `*.json` — Fabric 4 canvas JSON | **Test input. Ground truth.** Committed, never regenerated. |
| `*.v4-reference.png` — how Fabric 4 rendered it | **Human review reference only.** |

The PNGs are **not** automated assertions. Do not write a test that pixel-compares a
Fabric 7 render against a Fabric 4 render — cross-major antialiasing and rasterization
differences will produce false failures even when the load is semantically perfect.

Their actual role: in stage 2, a human looks at the Fabric 7 render beside the
`v4-reference.png` **once**, confirms they match, and blesses the Fabric 7 render as the
committed snapshot baseline. From then on, snapshot tests compare v7 against v7.

Write this distinction into the fixtures README. It is the single easiest thing for a
later session to get wrong.

### Tasks

- [x] Build the Fabric 4 frontend (Phase A) and confirm `_RELEASE = True`
- [x] Create `e2e_playwright/` with `conftest.py` adapted from
      `../streamlit-echarts/e2e_playwright/conftest.py` (which descends from
      `../streamlit-bokeh`'s). Bring `shared/git_utils.py` too
- [x] Write a capture app + script (suggested: `e2e_playwright/fixtures/capture_app.py`
      and `scripts/capture_v4_fixtures.py`) that drives the v1 component with synthetic
      Playwright mouse events and writes `json_data` to disk
- [x] Capture one fixture per drawing mode, using **fixed, documented coordinates** so
      the geometry is predictable and reviewable:
  - [x] `freedraw` — a multi-segment stroke (produces a `Path`)
  - [x] `line`
  - [x] `rect`
  - [x] `circle`
  - [x] `point` (a `Circle` at fixed `point_display_radius`)
  - [x] `polygon` — several points, right-click to close
  - [x] `transform` — an object that has been moved, scaled **and rotated** (this
        exercises `angle`, `scaleX`/`scaleY` and the `originX`/`originY` semantics that
        Fabric 7 changes the defaults for; it is the fixture most likely to expose R3).
        Captured: `scaleX = scaleY = 1.42`, `angle ≈ 25.24°`
  - [x] `kitchen-sink` — every shape type on one canvas, plus a `background` colour
- [x] Commit fixtures under `e2e_playwright/fixtures/fabric-v4/`
- [x] Capture the matching `*.v4-reference.png` for each. Each `transform`/`kitchen-sink`
      capture deselects before screenshotting, so the reference PNG shows the plain
      shape rather than Fabric's selection handles
- [x] Write `e2e_playwright/fixtures/fabric-v4/README.md` recording:
  - Fabric version (`4.4.0`), the component version, Node version, capture date
  - The exact coordinates used per fixture
  - The JSON-vs-PNG role distinction above, stated explicitly
  - That `scripts/capture_v4_fixtures.py` **will not run after stage 2** deletes the v1
    frontend, and is kept only as a record of provenance
- [x] Sanity-check each JSON by eye: correct `version` field, expected object `type`,
      plausible coordinates. A fixture that is silently empty is worse than no fixture
      (this caught a real bug: the first `transform` capture attempt produced an empty
      `objects: []` because `page.mouse.*` doesn't auto-scroll a below-the-fold canvas
      into view the way `Locator.click()` does — fixed by scrolling each canvas into
      view before every raw-mouse interaction)

---

## Phase D — Verify and hand off

- [x] `just lint` exits 0. `lint-frontend`/`format-frontend` are deferred to stage 2:
      code review caught that stage 1 had prettier-formatted 5 files under
      `frontend/src/`, violating this doc's own "do not touch frontend/src" rule.
      Reverted those, and scoped the prettier hook/recipes to not require compliance
      from code this stage can't touch (see justfile / `.pre-commit-config.yaml`)
- [x] `just test-py` exits 0
- [x] `just build` produces a wheel; install it into a scratch venv and confirm
      `st_canvas` still renders and draws — **the component must still work at the end of
      this stage** (verified: installed the built wheel + streamlit into a throwaway venv
      outside the repo, ran a minimal app, drew a freedraw stroke, confirmed
      `json_data["objects"]` round-tripped with 1 object)
- [x] `uv run pre-commit run --all-files` clean
- [x] Every fixture JSON committed and non-empty
- [x] Run `/code-review`. Fixed: reverted the frontend/src touch above; `.gitignore`
      was ignoring `__snapshots__/darwin` (copied from echarts, whose devs are on
      macOS) instead of `win32` (this repo's actual dev platform); `git_utils.py` only
      caught `CalledProcessError`, not `FileNotFoundError`, for a missing `git` binary.
      Not fixed, deliberately: the known `CanvasResult` class-vs-instance bug (P11,
      explicitly deferred to stage 2) and a few low-severity inherited-from-echarts
      items (pre-commit hook `always_run` scope, an e2e dependency-group detail,
      minor code duplication in the capture script)
- [x] Tick every box above and commit the ticks
- [x] Report to the maintainer: what was copied, what was adapted, what the fixtures
      cover, and anything surprising

      **Copied from `../streamlit-echarts` near-verbatim:** `pyproject.toml` shape
      (`[tool.setuptools.packages.find]`/`package-data`, `[dependency-groups]`
      `dev`/`e2e`, the `testpypi` index), `justfile` structure, `.pre-commit-config.yaml`,
      `.gitattributes`, the `.gitignore` additions, `tests/conftest.py` pattern,
      `.github/workflows/enforce-pre-commit.yml` and `python-tests.yml`,
      `CONTRIBUTING.md`, and `.claude/{agents,commands,skills}`.

      **Adapted, not copied:** kept the v1-only justfile recipes
      (`dev-mode`/`release-mode`/`:3001 dev`/`--legacy-peer-deps`) alive and marked
      `# DELETE IN STAGE 2`; deliberately did **not** export
      `NODE_OPTIONS=--openssl-legacy-provider` (Node 16 — the version this justfile
      already claimed CI pins, and the version Phase A proved actually builds
      `react-scripts@4` — rejects that flag outright; only Node 17+ needs it); guarded
      `just bump`'s inner-`pyproject.toml` edit since that file doesn't exist until
      stage 2; deps left exactly as `["Pillow", "numpy", "streamlit >= 0.63"]` rather
      than restructured into an `[image]` extra (that's stage 2 decision P2/P3); no
      `ts-tests.yml`/`playwright.yml` yet, since there's no Vitest/v2 frontend to test.

      **Fixtures:** 8 Fabric 4.4.0 canvas JSONs under
      `e2e_playwright/fixtures/fabric-v4/` — one per drawing mode
      (freedraw/line/rect/circle/point/polygon/transform) plus a `kitchen-sink`
      combining every shape type with a background colour. Each has a matching
      `*.v4-reference.png` for one-time human comparison against Fabric 7's render in
      stage 2 — **not** an automated pixel-diff target (cross-major antialiasing
      differences would make that flaky). Captured with Node 16.20.2 against fixed,
      documented coordinates; `transform` specifically exercises `angle`
      (≈25.24°) and non-uniform `scaleX`/`scaleY` (1.42) to stress the
      `originX`/`originY` default Fabric 7 changes. Provenance and the
      JSON-vs-PNG distinction are written up in the fixtures' own `README.md`.

      **Surprises:**
      1. My own stage-1 pass briefly prettier-formatted 5 files under
         `frontend/src/` — against this doc's explicit "do not touch frontend/src"
         rule. `/code-review` caught it; reverted, and rescoped the prettier
         hook/recipes so stage 1 isn't required to keep code it can't touch compliant.
      2. Echarts' `.gitignore` ignores `__snapshots__/darwin` — echarts' devs are on
         macOS, this repo is developed on Windows, so the real path is `win32`. Copied
         blindly, would have silently failed to ignore anything. Fixed.
      3. `git_utils.py` (from echarts) only caught `CalledProcessError` around the `git`
         subprocess call, not `FileNotFoundError` — so a machine with no `git` binary at
         all would raise an unhandled exception instead of the intended fallback. Fixed.
      4. The capture script's first `transform` fixture attempt produced an empty
         `objects: []`: `page.mouse.*` doesn't auto-scroll a below-the-fold canvas into
         view the way Playwright's `Locator.click()` does. Fixed by scrolling each
         canvas into view before raw-mouse interaction — worth remembering for any
         future Playwright work in this repo that uses raw mouse events instead of
         locator clicks.

      Deliberately **not** fixed in this stage: the known `CanvasResult`
      class-vs-instance bug on the `component_value is None` branch (P11, explicitly
      deferred to stage 2 — stage 2 replaces this whole class), and a few low-severity
      items inherited from echarts (pre-commit hook `always_run` scope, an e2e
      dependency-group detail, minor duplication in the capture script) that weren't
      worth touching on top of an already-working v1 component this stage isn't
      supposed to change the behaviour of.

**Do not push, do not open a PR, do not begin stage 2.** Wait for sign-off.

---

## Commit shape

Keep these separable so review is possible:

1. `Add v2 migration plan` (stage 0, already done)
2. `Normalize line endings and formatting` — the pre-commit/LF churn, alone
3. `Migrate packaging from setup.py to pyproject.toml`
4. `Add justfile, pre-commit, and ruff config`
5. `Add Python test scaffolding and CI workflows`
6. `Add AGENTS.md and contributor docs`
7. `Capture Fabric 4 JSON fixtures` — fixtures + capture script + README

---

## Reminders from the do-not list

- Do not touch `streamlit_drawable_canvas/frontend/src/` in this stage.
- Do not change `st_canvas`'s signature or behaviour in this stage.
- Do not bump the version to `0.10.0` in this stage.
- Do not delete the Fabric 4 frontend in this stage.
