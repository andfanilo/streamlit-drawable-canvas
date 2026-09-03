# Issue triage against the v2 rewrite

**Prerequisite reading:** `00-plan.md`, §2 (decision log) and §3 (do-not list).
**Status:** triage complete, no work started.
**Scope:** the 50 issues open on `andfanilo/streamlit-drawable-canvas` as of 2026-09-03,
assessed against the state of `feat/components-v2` at commit `ace781f`.

This document exists so the 0.10.0 issue sweep is a checklist and not a re-reading of
ten years of issues. It answers two questions:

1. **§1** — which open issues the migration already fixed, and which of those are safe to
   close on inspection versus need a test first.
2. **§2–§4** — what remains, ranked by cost against reward, so the "should this land in
   0.10.0?" call is made once.

Nothing here reopens a `00-plan.md` decision. Where an issue asks for something the plan
already rejected, §4 says so and cites the decision ID.

---

## 1. Resolved by the migration — 19 issues

### 1.1 Safe to close on inspection — 12 issues

**Background image (7).** The dominant cluster, and the highest-demand issue on the
tracker sits in it. In 0.9.x `background_image` went through
`streamlit.elements.image.image_to_url` → a Streamlit media-endpoint URL → fetched *from
inside an iframe*. Every deployment topology that rewrote, scoped or proxied that URL
broke it. P6/P7 replaced the whole path with a Python-side `data:` URI and v2 removed the
iframe, so there is no fetch left to fail.

| # | 👍 | Title | Note |
|---|---|---|---|
| #93 | **10** | No background image in multipage app | Highest-reaction issue on the tracker |
| #142 | 2 | Blank on cloud, including the live demo | |
| #133 | | Broken with `--server.baseUrlPath` | |
| #129 | | Broken on GCP | |
| #119 | | Broken with `st_pages` | |
| #70 | | URL backgrounds broken on Streamlit Cloud in 0.9.0 | |
| #143 | | Race condition / intermittent 404 | Also covered by `background.ts`'s generation guard and its un-memoize-on-error retry |

**Private Streamlit API (1).**

| # | Title | Note |
|---|---|---|
| #157 | `AttributeError: module 'streamlit.elements.image' has no attribute 'image_to_url'` | Same root cause as the already-closed #156. P6 forbids private Streamlit APIs outright |

**Toolbar theming (2).** F5 replaced the PNGs with inline SVG on `currentColor`, driven by
`var(--st-text-color)`.

| # | 👍 | Title | Note |
|---|---|---|---|
| #104 | 4 | Allow changing toolbar color, or inherit from theme | Fully solved — the icons now follow the Streamlit theme, dark mode included |
| #63 | 1 | Alter canvas toolbar symbols | **Partial.** The colour complaint (the actual blocker in the report) is solved; swapping the *symbols* is still unsupported. Close citing the colour fix, or keep a narrowed issue open |

**Build toolchain (2).** Vite 8 + Node 24 replaced `react-scripts@4`, and v2 has no
dev-server handshake to fail.

| # | Title |
|---|---|
| #135 | Could not build on Node 18 (`ERR_OSSL_EVP_UNSUPPORTED`, needs `--openssl-legacy-provider`) |
| #101 | "Trouble loading the component" after hand-patching `package.json` to get CRA to build |

### 1.2 Verified fixed by regression test — 7 issues

All seven trace to v1's iframe height negotiation plus React remounting the canvas on
every rerun. F3's module-scoped `WeakMap` and `applyData`'s per-field diffing mean the
canvas, its history and its in-progress drawing now survive an unrelated rerun.

| # | 👍 | Title |
|---|---|---|
| #137 | 4 | Page reloads continuously when `st_canvas` is called |
| #95 | 3 | Canvas disappears ~1s after loading (sibling of the closed #79) |
| #84 | 2 | Canvas result clears itself |
| #138 | 1 | Canvas invisible on first run, appears only on rerun |
| #141 | | `st.session_state` cleared when canvas `height < 300` |
| #77 | | Canvas recreated on every rerun when used with `session_state` |
| #10 | | Add polyline/polygon — **stale**, shipped in 0.8.0; close outright, no test needed |

**Why these are not in §1.1:** the fix is architectural rather than targeted, and none of
these has a repro on the branch. #141 in particular may always have been a Streamlit-side
bug of that era rather than ours — closing it as "fixed by the rewrite" without evidence
risks an embarrassing reopen.

**Gate for closing this group.** Most of it already exists:
`canvas_isolation_test.py::test_undo_history_survives_an_unrelated_rerun` draws on a
canvas, reruns from an unrelated button, and asserts both the drawing and undo's reach
survive. That covers #137, #95, #84, #138 and #77. Its canvas is already `height=200`,
so #141's `< 300` trigger condition is exercised incidentally -- what is missing is the
assertion #141 is actually about.

- [x] Added a `st.session_state` key to `canvas_isolation.py`, set before the canvases
      and read back after them, plus `test_session_state_survives_canvas_creation`
      asserting it on load and across an unrelated rerun. **Passes** — a cleared state
      would surface as a `KeyError` in the app itself, so this is a real check, not a
      tautology. #141 is fixed
- [ ] Optional, for #137 specifically: assert the app does not re-run on its own after
      the drawing settles (no unprompted script runs within a fixed window). Not done —
      the existing rerun test would already be flaky if a reload loop were present

**Gate met.** All seven are now safe to close on release alongside §1.1.

---

## 2. Low-hanging fruit — recommended for 0.10.0

Seven changes, 14 issues. Every one is either documentation or a contained change with an
obvious test.

### F1 — `FAQ.md`: a `json_data` field reference (6 issues)

**Cost:** docs only. **Reward:** highest issue-per-hour ratio on the board.

`00-plan.md` §4 already lists `FAQ.md` in the target end state and it was never written.
Six open issues are variants of "how do I read the JSON":

| # | Asks | Answer to document |
|---|---|---|
| #96 | Troubleshooting docs for the JSON data | The issue itself cites losing time to the closed #36 |
| #150 | Freedraw point coordinates | They are already there — `Path.path` |
| #82 | Coordinates of a mouse click | `drawing_mode="point"`, then read `left`/`top` |
| #121 | Original pixel coords for a large image | No rescaling is done on import; the `st_canvas` docstring already warns, the FAQ should show the arithmetic |
| #100 | Canvas does not reset on a new upload | Pass a new `key`, or drive `initial_drawing` |
| #151 | Deleting a drawn shape without repeated undo | Double-click it in `transform` mode. Currently undocumented anywhere |

Must also cover, because it is the single most-repeated confusion in the tracker's
history: **transform mode reports `scaleX`/`scaleY`, not mutated `width`/`height`** (closed
#36, #65).

- [x] Write `FAQ.md`
- [x] Link it from `README.md` (above the API section)
- [x] Note it in the 0.10.0 CHANGELOG entry

Every structural claim is backed by the committed `e2e_playwright/fixtures/fabric-v4/`
captures or by an assertion in `canvas_modes_test.py` -- notably the `scaleX: 1.42` with
unchanged `width: 120` in `transform.json`, which is #96/#36's exact confusion in real
captured output.

### F2 — `background_image_fit` (2 issues)

**Cost:** ~15 lines in `background.ts` plus one Python param. **Reward:** medium-high.

`fitToCanvas` (`background.ts`) hard-stretches the image to the canvas dimensions. #103
and #120 are the same request from opposite ends:

- #103 — allow the canvas to be *larger* than the image, so rectangles can be drawn near
  the edge without the drag registering as a declick. Current workaround is padding the
  image in Python and un-padding after.
- #120 — preserve aspect ratio rather than distorting.

One knob (`"stretch"` — current behaviour, default — versus `"contain"`) closes both.
Keep the default as-is so this is additive, not breaking.

- [x] `background_image_fit: str = "stretch"` on `st_canvas`, validated like
      `drawing_mode`. Appended last in the signature so nothing shifts positionally
- [x] `contain` branch in `fitToCanvas` (uniform scale, centred), honoured by
      `rescaleBackgroundImage` too. `applyData`'s background memoization now keys on fit
      as well as URL, so a fit change re-fits the loaded image without re-fetching it
- [x] Demo app coverage (a sidebar selectbox)
- [x] Playwright: 3 tests. **No screenshot snapshot after all** — a solid-colour image on
      a mismatched aspect ratio makes the two modes separable by sampling single pixels
      via `getImageData`, which is immune to the antialiasing sensitivity T3 warns about.
      One test toggles fit at runtime to cover the re-fit-without-re-fetch branch

### F3 — `disabled`: read-only canvas (1 issue)

**Cost:** ~20 lines. **Reward:** high.

#140 wants to show a drawing back to a viewer without letting them modify it (the
reporter shows marked-up student assignments). Implementation: skip tool handler
registration entirely, force `canvas.selection = false` and every object non-`evented`.
Self-contained, no interaction with the tool registry beyond bypassing it.

- [x] `disabled: bool = False` on `st_canvas`, threaded through `DrawableCanvasData`.
      Appended last in the signature so no existing positional argument shifts
- [x] `reconfigureTool` registers no tool at all when set, and applies a read-only pass
      (no drawing mode, no selection, every object non-`evented`)
- [x] Toolbar **hidden** when disabled, overriding `display_toolbar` — undo/redo/reset
      would otherwise mutate a read-only canvas. Documented in README/FAQ/CHANGELOG
- [x] **Found and fixed while testing:** the `mouse:up`/`mouse:dblclick` handlers are
      registered on the canvas, not by the tool, so a disabled canvas still snapshotted
      and sent on the first click — replacing the Python-supplied payload with Fabric's
      serialization of it and triggering a rerun. Both handlers now early-return when
      disabled
- [x] Playwright: 4 tests in `canvas_disabled_test.py`, including an enabled control so
      the "nothing happened" assertions can't pass for the wrong reason

### F4 — Mobile: verify, do not implement (2 issues) — DROPPED from 0.10.0

**Maintainer decision, 2026-09-03: dropped.** Mobile is not a priority for this release,
and mobile was already broken in 0.9.x, so shipping without it regresses nothing. #144
and #105 stay open; `05-issue-responses.md` group C carries the honest "please retest and
report back" reply rather than a fixed claim.

The attempt is preserved in `git stash` ("F4 mobile touch verification (inconclusive)").
It contains a working additive `touch_app` fixture for `conftest.py` and a
`canvas_touch.py` app; the tests it left behind fail, and **it was never established
whether that is the component or the test harness** — the CDP `Input.dispatchTouchEvent`
drags were themselves unvalidated. Do not cite those failures as evidence of a component
bug. Whoever picks this up should first answer one question: does `touchstart` reach
`canvas.upper-canvas` at all?

The original plan follows, unchanged, for whoever resumes it.


**Cost:** one Playwright test. **Reward:** two 2023 issues closed at zero code cost.

#144 (points don't register on mobile) and #105 (only freedraw works on mobile) were both
filed against the Fabric 4 frontend, which used separate mouse and touch paths. Fabric 7
uses Pointer Events throughout and sets `touch-action: none` on its own canvas element
(`node_modules/fabric/dist/index.mjs:10548`, driven by `allowTouchScrolling: false`).

**These are likely already fixed for free.** Confirm before claiming it.

- [ ] Playwright test under touch emulation exercising `point`, `rect` and `line`
- [ ] If it fails, the first thing to check is whether the shadow root (F4) interferes
      with Fabric's `touch-action` styling — that would be an R2-adjacent finding and
      worth reporting rather than patching blind

### F5 — Respect per-object lock flags in transform mode (1 issue)

**Cost:** ~5 lines. **Reward:** medium. **Behaviour change — changelog it.**

`transform.ts` does `canvas.forEachObject(o => o.selectable = o.evented = true)`, which
clobbers `selectable: false`, `lockMovementX`, `lockScalingX` etc. set deliberately in
`initial_drawing`. #97 wants a rectangle the user can move but not resize; Fabric already
supports exactly that through JSON properties we are overwriting.

Fix: only promote objects that do not explicitly opt out, and never touch the `lock*`
family.

- [ ] Narrow the `forEachObject` promotion
- [ ] Round-trip test: `initial_drawing` with `lockScalingX/Y`, assert scaling is refused
      and movement is not
- [ ] CHANGELOG under a "Changed" heading — someone may be relying on the clobber

### F6 — Object ordering in transform mode (1 issue)

**Cost:** ~25 lines, entirely inside `transform.ts`. **Reward:** low-medium.

#8, `enhancement`-labelled since 2020: bring the selected object forward / send it
backward. `bringObjectForward` / `sendObjectBackwards` on `[` and `]` with an active
selection.

- [ ] Keyboard handlers registered and torn down by `configureCanvas`'s cleanup
- [ ] Document the bindings in `FAQ.md` (F1) — an undocumented keybinding helps nobody

### F7 — Toolbar spacing (1 issue)

**Cost:** one line. **Reward:** low, but it is one line.

#88: the bin icon sits close enough to the canvas that users hit it by accident.
`instance.ts` positions the toolbar at `canvasHeight + 4`. Increase the gap and adjust
`TOOLBAR_HEIGHT` so the container height stays correct.

- [ ] Bump the offset; re-check `display_toolbar=False` still collapses cleanly

---

## 3. Medium — defer to 0.11.0 unless scope is deliberately widened

Each of these is genuinely wanted. None is migration-shaped, and every one widens the
review surface at the exact moment the branch is trying to land.

| # | Issues | Item | Cost | Reward | Note |
|---|---|---|---|---|---|
| M1 | #17, #110 | **Text tool** | ~60 lines + API surface | **High** | The best remaining feature on the board — `enhancement`-labelled since 2020, and #110's "annotate a rectangle" is the same ask. Fabric's `IText` does the work. But it adds a `drawing_mode`, a `_VALID_DRAWING_MODES` entry, E2E coverage and a JSON shape to support forever. Ship 0.10.0 first |
| M2 | #109 | **Polygon won't close** | ~15 lines | Medium | Closing needs a right-click: undiscoverable, and impossible on touch. Add closing by clicking the start circle, or Escape. Small, but it is the most stateful tool in the codebase and deserves its own test pass. Interacts with F4 |
| M3 | #89 | **Accidental delete on double-click** | ~10 lines | Medium | `transform.ts` deletes the active object on `mouse:dblclick` unconditionally. Gate it behind a param and/or move to Delete/Backspace. Cheap, but it changes behaviour that #151's answer (F1) actively depends on — do both together or neither |
| M4 | #66 | **Eraser** | ~40 lines | Medium | Fabric removed `EraserBrush` in v6+. "Delete the object under the cursor" is tractable; true pixel erasing is not. Set expectations in the issue before building |
| M5 | #87, #139 | **Bounds sit outside the drawn edge** | doc, then maybe code | Medium | Real, and #139 (medical ROI spill-over) is a legitimate complaint. Root cause is stroke geometry — `left`/`top` exclude half the stroke width. **Document it in `FAQ.md` first**, then decide whether `strokeUniform` or a change to reported bounds is warranted. Do not change coordinate reporting casually; it is the component's contract |
| M6 | #147 | Left vs. right click for points | doc | Low | Right-click currently only force-sends; the point is not recorded and is not distinguishable in the JSON. Answer in `FAQ.md` |

---

## 4. Out of scope — close with a pointer to the rationale

These are not "no". They are "not part of this migration, and here is the decision that
says why".

| # | Ask | Disposition |
|---|---|---|
| #154, #39 | Responsive canvas / `use_container_width` | **Explicitly forbidden** — P9 and the `00-plan.md` §3 do-not list. Fabric JSON coordinates live in canvas pixel space; a responsive canvas makes every saved drawing device-dependent. §2.2 already records it as a wanted feature deliberately deferred. Answer by citing P9 |
| #99, #92 | Zoom / pan / infinite canvas | Viewport transform makes every `json_data` coordinate ambiguous — same coordinate-space problem as P9, larger. **Check what closed #111 ("Zoom in/out implementation") actually resolved before answering #99** |
| #94 | Stroke width from touch pressure | Needs a custom Fabric brush. Niche, self-contained, good external-contribution candidate |
| #11 | Snapping | `enhancement`-labelled, real feature, not migration-shaped |
| #19, #40 | Icon library drag-and-drop / SVG import | #40 is the prerequisite for #19. Large, and #19 implies an asset-hosting story this component does not have |
| #123, and the naming half of #151 | Per-object ids, labels, automatic distinct colours | Needs custom-property serialization *and* a UI to set the properties. Fabric supports the serialization (`toObject(['id', 'label'])`); there is nothing to serialize until objects can be labelled, so this blocks on M1 |

---

## 5. Recommended cut for 0.10.0

**Land F1–F4.** Roughly a day, closes 14 issues, and every piece is either documentation
or a contained change with an obvious test. F1 alone is the best value on the page and is
already promised by `00-plan.md` §4.

**F5–F7 are optional.** Cheap, but each is a small behaviour change that widens the review
surface. Drop them if the branch needs to land sooner; they carry cleanly to 0.11.0.

**Sequencing against `03-release.md`:** all of this lands *before* Phase C. Nothing here
should be attempted after `just bump 0.10.0`.

- [x] F1 `FAQ.md`
- [x] F2 `background_image_fit`
- [x] F3 `disabled`
- [x] F4 mobile verification test — **dropped**, see F4 above
- [x] §1.2 lifecycle regression test — done, `canvas_isolation_test.py` (3 passed)
- [ ] (optional) F5, F6, F7
- [ ] Re-run `just lint && just test && just build && just e2e`
- [ ] CHANGELOG: fold F2/F3 into the 0.10.0 "Added" section; F5 into a "Changed" section
- [ ] On release, sweep-close §1 (19 issues) referencing the 0.10.0 CHANGELOG entry
- [ ] Answer §4 (9 issues) citing the decision IDs, and close
