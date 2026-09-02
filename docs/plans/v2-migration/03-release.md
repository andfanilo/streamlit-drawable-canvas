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

- [ ] `demo_app.py` exists at the repo root, but there is no `just demo` recipe yet (T8) —
      the justfile only defines a `demo_app` variable
- [x] Exercise every `drawing_mode`: freedraw, transform, line, rect, circle, point, polygon
- [ ] Exercise the changed surface specifically:
  - [ ] `background_image` with each accepted input type (URL, path, bytes, PIL) — this is
        the parameter that was broken, so it should be the most visible thing in the demo
  - [x] `return_image_data=True` alongside the default, so the difference is legible
  - [x] `update_streamlit=False` plus force-send
  - [ ] `initial_drawing` round-trip
  - [x] `display_toolbar=False`
  - [ ] a canvas inside `st.form`
- [ ] Verify the toolbar renders correctly in **both** light and dark themes — F5 gave it
      dark-mode support for the first time and this is where you confirm it
- [x] Keep it readable. `../streamlit-echarts/demo_app.py` is 36 KB; this does not need to be

---

## Phase B — Documentation

### B1 — README

- [ ] Keep the existing top matter: the best-effort banner, badges, the demo GIF, the
      link to the upstream Streamlit issue
- [ ] Update **Installation** — mention the `[image]` extra and what it is for
- [ ] Update **Example Usage** — the current snippet reads `canvas_result.image_data`
      unconditionally and would now raise. This is the single most-copied block in the
      repo; make the corrected version obvious
- [ ] Update the **API** section: `return_image_data`, `on_change`, the widened
      `background_image`, and the new floors
- [ ] Add an **"Upgrading from 0.9.x"** section (see B3)
- [ ] Rewrite **Development** for the new `just` recipes; delete the `_RELEASE` / `:3001`
      dev-server instructions and the Cypress section
- [ ] Update **References** — drop the React-hooks and Cypress links that no longer apply

### B2 — CHANGELOG

- [ ] Add a `## [0.10.0]` entry. Preserve all existing history
- [ ] Lead with the breaking changes, plainly:
  - `image_data` is **opt-in** — pass `return_image_data=True`; `Pillow` and `numpy` moved
    to the `[image]` extra
  - minimum Streamlit is now **1.53**; minimum Python **3.10**
  - built on **Streamlit Components v2** and **Fabric.js 7** (from 4.4.0)
  - `background_image` now accepts URL / path / bytes / PIL, **and works again** — it was
    broken on Streamlit ≥ 1.5x because a private Streamlit API moved
  - state the outcome of the Fabric v4 JSON compatibility verification (stage 2, F3)
    explicitly — whether old saved drawings load, and any caveat
- [ ] Then the additions: `on_change`, dark-mode toolbar, no-iframe rendering, undo history
      surviving reruns
- [ ] Then the fix: `CanvasResult` was returned as a class rather than an instance

### B3 — Upgrading section

Short, in the README, not a separate file (settled). For each break: what changed, what
the error looks like, and the one-line fix.

- [ ] `image_data` is `None`/raises → add `return_image_data=True` and install `[image]`
- [ ] Old Streamlit / Python → pin `streamlit-drawable-canvas==0.9.3`
- [ ] Saved drawings from 0.9.x → whatever stage 2's verification actually established.
      **Do not write a reassuring sentence the tests did not earn**

### B4 — AGENTS.md

- [ ] Rewrite to describe the **v2** architecture — it described v1 as of stage 1
- [ ] Follow echarts' structure: Platform & Requirements, Component (Python / frontend
      renderer / submodules), Build & Validation Commands, recipe reference table
- [ ] Point at `docs/plans/v2-migration/` as the historical record of *why*
- [ ] Resolve the dependabot open item (`00-plan.md` §7): either add
      `.github/dependabot.yml` or note that `merge-dependabot` depends on repo settings

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

- [ ] Every README code block actually runs
- [ ] The CHANGELOG's compatibility claims match what the tests established
- [ ] `just demo` works from a clean `just setup`
- [ ] Run `/code-review`
- [ ] Tick every box and commit

---

## Reminders

- Nothing is pushed, tagged or published without explicit maintainer approval.
- Do not soften the breaking-change notes. Users who copy the README snippet will hit
  `return_image_data` immediately; they should read about it first.
- Do not touch `../streamlit-drawable-canvas-demo` from this branch.
