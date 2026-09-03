# Stage 3 — Documentation, demo, and release

**Prerequisite reading:** `00-plan.md`, in full.
**Prerequisite state:** stage 2 complete, signed off by the maintainer, and passed its
Opus review pass.
**Gate on completion:** maintainer sign-off before anything is pushed, tagged or published.

## Goal

Make 0.10.0 explicable to the people it breaks, give the repo a demo app matching
`../streamlit-echarts`, and cut the release.

---

## Phase A — Demo app

**Partly done in stage 2** — the mode/param coverage was pulled forward so the stage-2
surface could be verified by hand before sign-off (commit `9697da9`). What remains is
the `background_image` / `initial_drawing` / form coverage and the `just demo` recipe.

- [x] `demo_app.py` exists at the repo root; added `alias demo := run` to the justfile (T8)
      rather than renaming `run` — `CONTRIBUTING.md` and other docs already reference
      `just run` and this repo's frontend is CRA-free, so nothing was lost by keeping both
      names live
- [x] Exercise every `drawing_mode`: freedraw, transform, line, rect, circle, point, polygon
- [x] Exercise the changed surface specifically:
  - [x] `background_image` with each accepted input type (URL, path, bytes, PIL) — this is
        the parameter that was broken, so it should be the most visible thing in the demo.
        Added a `background_image source` sidebar selectbox driving all four; a generated
        (not bundled) sample image backs path/bytes/PIL, `https://static.streamlit.io/examples/cat.jpg`
        backs URL. **Manually verified live, all four**: each renders correctly, scaled to
        fill the canvas, background_color correctly cleared per P6/P7
  - [x] `return_image_data=True` alongside the default, so the difference is legible
  - [x] `update_streamlit=False` plus force-send
  - [x] `initial_drawing` round-trip — added a second, independent canvas below the main
        one in `transform` mode, fed the main canvas's `json_data`. **Manually verified
        live**: draws on the primary canvas immediately appear on the round-trip canvas
  - [x] `display_toolbar=False`
  - [x] a canvas inside `st.form` — added a form section with its own canvas + submit
        button. **Manually verified live**: drawing inside the form, then submitting,
        correctly delivers the drawing's `json_data` to Python (`setStateValue` isn't
        subject to form batching the way a trigger would be — P8)
- [x] Verify the toolbar renders correctly in **both** light and dark themes — F5 gave it
      dark-mode support for the first time and this is where you confirm it. **Manually
      verified live** via the app's theme switcher: light mode renders dark icons on the
      light app background (as before); dark mode correctly flips the icons to
      light-on-dark, confirming `--st-text-color` propagates through the shadow root
- [x] Keep it readable. `../streamlit-echarts/demo_app.py` is 36 KB; this does not need to be

---

## Phase B — Documentation

### B1 — README

- [x] Keep the existing top matter: the best-effort banner, badges, the demo GIF, the
      link to the upstream Streamlit issue
- [x] Update **Installation** — mention the `[image]` extra and what it is for, plus the
      new Streamlit/Python floors
- [x] Update **Example Usage** — already read `image_data` only after passing
      `return_image_data=True` (fixed in stage 2's Opus review pass); left as-is, verified
      it still runs (see Phase E)
- [x] Update the **API** section: `return_image_data`, `on_change`, the widened
      `background_image`, and the new floors were already present from stage 2's review
      pass; added the `drawing_mode` ValueError note, the polygon exception on
      `update_streamlit`, and removed a leftover duplicate `display_toolbar`/`key` bullet
- [x] Add an **"Upgrading from 0.9.x"** section (see B3)
- [x] Rewrite **Development** for the new `just` recipes (`just demo`, `just dev` watch-
      rebuild, `just e2e`); delete the `_RELEASE` / `:3001` dev-server instructions and the
      Cypress section
- [x] Update **References** — dropped the React-hooks and Cypress links, and the Flaticon
      icon attribution (the toolbar icons are now hand-authored inline SVG, not the old
      PNGs) and the CSS-filter-generator link (the recolor hack it supported is gone)

### B2 — CHANGELOG

- [x] Add a `## [0.10.0]` entry. Preserve all existing history
- [x] Lead with the breaking changes, plainly:
  - `image_data` is **opt-in** — pass `return_image_data=True`; `Pillow` and `numpy` moved
    to the `[image]` extra
  - minimum Streamlit is now **1.53**; minimum Python **3.10**
  - built on **Streamlit Components v2** and **Fabric.js 7** (from 4.4.0)
  - `background_image` now accepts URL / path / bytes / PIL, **and works again** — it was
    broken on Streamlit ≥ 1.5x because a private Streamlit API moved
  - state the outcome of the Fabric v4 JSON compatibility verification (stage 2, F3)
    explicitly — whether old saved drawings load, and any caveat
- [x] Then the additions: `on_change`, dark-mode toolbar, no-iframe rendering, undo history
      surviving reruns
- [x] Then the fix: `CanvasResult` was returned as a class rather than an instance

### B3 — Upgrading section

Short, in the README, not a separate file (settled). For each break: what changed, what
the error looks like, and the one-line fix.

- [x] `image_data` is `None`/raises → add `return_image_data=True` and install `[image]`
- [x] Old Streamlit / Python → pin `streamlit-drawable-canvas==0.9.3`
- [x] Saved drawings from 0.9.x → wrote exactly stage 2's F3 finding (circle/point sliver,
      radians→degrees, declared breaking, no shim) and nothing more

### B4 — AGENTS.md

- [x] Rewrite to describe the **v2** architecture — it described v1 as of stage 1
- [x] Follow echarts' structure: Platform & Requirements, Component (Python / frontend
      renderer / submodules), Build & Validation Commands, recipe reference table
- [x] Point at `docs/plans/v2-migration/` as the historical record of *why*
- [x] Resolve the dependabot open item (`00-plan.md` §7): noted `merge-dependabot` has no
      corresponding `.github/dependabot.yml`, matching `../streamlit-echarts` — configured
      via repo settings or not enabled, not something to invent

---

## Phase C — Release

Do not run any of this without explicit maintainer approval. Publishing is irreversible.

- [ ] `just bump 0.10.0` — syncs root `pyproject.toml`, the inner `pyproject.toml`,
      `uv.lock`, and the frontend `package.json`/`package-lock.json`. Confirm the inner
      manifest is actually included (it was guarded/absent in stage 1)
- [ ] Full validation: `just lint && just test && just build && just e2e`
- [ ] Open the PR from `feat/components-v2` → `develop`. **This is the first push.**
- [ ] After merge to `develop`: `just tag-release 0.10.0` (ff-merges to `main`, annotated
      tag, pushes both)
- [ ] `just publish-test` → install from Test PyPI into a clean venv and smoke-test both
      with and without the `[image]` extra
- [ ] `just publish` — **only on explicit maintainer instruction**
- [ ] Create the GitHub release from the tag, using the CHANGELOG entry

---

## Phase D — Downstream

- [ ] `../streamlit-drawable-canvas-demo` — **after** 0.10.0 is on PyPI (T8). Its snippet
      reads `image_data` unconditionally and breaks on release. Mirrors how
      `streamlit-echarts-demo` trails `streamlit-echarts`. Separate repo, separate PR,
      not part of this branch
- [ ] Consider a note on the upstream Streamlit issue linked from the README

---

## Phase E — Verify

- [x] Every README code block actually runs — both extracted and smoke-run under
      `uv run streamlit run` (headless), no server-side exceptions
- [x] The CHANGELOG's compatibility claims match what the tests established — the
      Circle/Point sliver note is copied from stage 2's F3 finding verbatim, not
      paraphrased
- [x] `just demo` works — verified against the current environment (not a from-scratch
      `just setup`/`npm ci`, which wasn't re-run this session)
- [x] Run `/code-review` — 2 findings on the working-tree diff, both fixed:
      `background_image`'s dict-literal selection in `demo_app.py` eagerly evaluated all
      four branches (including a disk write for the "Local path" sample) regardless of
      which was selected; replaced with an if/elif dispatch that only computes the
      selected one. `_sample_image`'s docstring embedded rationale ("so the demo needs no
      bundled asset") instead of stating a terse fact — trimmed. (A third flagged line,
      the pre-existing "Every value stringified" comment, predates this stage's diff and
      was left alone.)
- [x] Tick every box and commit

---

## Reminders

- Nothing is pushed, tagged or published without explicit maintainer approval.
- Do not soften the breaking-change notes. Users who copy the README snippet will hit
  `return_image_data` immediately; they should read about it first.
- Do not touch `../streamlit-drawable-canvas-demo` from this branch.
