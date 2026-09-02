# Stage 2 — Frontend rewrite and Python v2 API

**Prerequisite reading:** `00-plan.md`, in full.
**Prerequisite state:** stage 1 complete, signed off, and **the Fabric 4 JSON fixtures
committed**. Verify `e2e_playwright/fixtures/fabric-v4/*.json` exist and are non-empty
before you delete anything.
**Gate on completion:** maintainer sign-off **plus an Opus review pass**.

## Goal

Replace the React 16 / CRA / Fabric 4 / Components-v1 frontend with a reactless
TypeScript / Vite / Fabric 7 / Components-v2 implementation, and modernize the Python
API alongside it. This is the largest and riskiest stage.

---

## Phase A — Prove Fabric works in a shadow DOM (do this first)

This is risk **R2**, and it invalidates a settled decision if it fails. Spend at most a
few hours here, before building anything on top.

Decision F4 puts the component inside a shadow root (`isolate_styles=True`). Fabric
computes pointer positions from `getBoundingClientRect` and attaches document-level
listeners. Shadow-boundary event retargeting could break pointer coordinates, which
would break every drawing tool.

- [x] Minimal spike: a v2 component with `isolate_styles=True`, a Fabric 7 canvas inside
      it, and a freedraw brush
- [x] Draw near each corner and near the centre; confirm the stroke lands under the cursor
- [x] Confirm with the app scrolled, and with the component inside `st.columns` and
      `st.expander` (offset parents are where this breaks if it breaks)
- [x] Record the result in your report either way

**Result: PASS.** `parentElement` is a real `ShadowRoot` (`instanceof ShadowRoot`
confirmed at runtime) and Fabric 7's pointer math is unaffected by it. Verified two ways:

1. Synthetic `MouseEvent`s dispatched at known viewport coordinates (mousedown on
   `canvas.upperCanvasEl`, mousemove/mouseup on `document`, matching Fabric's own listener
   placement) against four instances — top-level, inside `st.columns`, inside
   `st.expander`, and scrolled ~2600px down the page. In every case the resulting
   freedraw `Path`'s raw point coordinates matched the intended canvas-local drag
   endpoints to within ~1px (sub-pixel brush smoothing noise, not positioning error).
2. A real OS-level mouse drag (via CDP) near the top-left corner of the top-level canvas,
   confirmed visually: the stroke lands exactly under the drag path, right at the corner.

Root cause understanding (why this was never at risk): Fabric attaches its `mousedown`
listener to `upperCanvasEl` itself (which lives inside the shadow root and receives
events normally), and its `mousemove`/`mouseup` listeners to
`getDocumentFromElement(upperCanvasEl)` — i.e. `ownerDocument`, the real top-level
`document`, not something shadow-scoped. Position is computed from
`upperCanvasEl.getBoundingClientRect()` and `event.clientX/clientY`, neither of which is
affected by shadow-root retargeting (retargeting only changes `event.target`/
`composedPath()`, never `clientX/Y` or `getBoundingClientRect()`). `isolate_styles=True`
stands as decided (F4); no fallback needed.

One incidental finding, not part of R2: a freedraw `Path`'s serialized `left`/`top` in
Fabric 7 reflect its *center* (origin now defaults to `"center"`, per R4's already-known
`originX`/`originY` default flip), not its top-left corner as in Fabric 4. This is
expected R4 work for Phase C/D, not a shadow-DOM bug — the raw `path` point data (used
for the above verification) was accurate throughout.

> **STOP condition R2.** If pointer coordinates are wrong inside the shadow root and
> there is no clean fix, **stop and report**. The fallback is `isolate_styles=False`, but
> that reverses a settled decision (F4) and the maintainer makes that call. Do not switch
> unilaterally.

---

## Phase B — Frontend scaffolding

Copy from `../streamlit-echarts/streamlit_echarts/frontend/` and adapt.

- [x] Rewrite `package.json`: `"type": "module"`, scripts
      (`build`/`build:frontend:production`/`clean`/`dev`/`format`/`test`/`test:watch`/`typecheck`)
  - dependencies: `@streamlit/component-v2-lib ^0.2.0`, `fabric ^7.4.0`
  - devDependencies: `vite ^8`, `typescript ^5.8`, `vitest ^4`, `@vitest/coverage-v8`,
    `jsdom`, `prettier`, `rimraf`, `cross-env`, `esbuild`, `@types/node`
  - **Remove** `@types/fabric` — Fabric 7 ships its own types
  - **Remove** react, react-dom, react-scripts, apache-arrow, hoist-non-react-statics,
    event-target-shim, lodash and their `@types`
- [x] `vite.config.ts` from echarts — library mode, `formats: ["es"]`,
      `fileName: "index-[hash]"`, `outDir: "build"`, `base: "./"`
- [x] `tsconfig.json` from echarts (`moduleResolution: "bundler"`, `types: ["vite/client"]`)
- [x] `vitest.config.ts` from echarts (jsdom environment)
- [x] Delete `.env`, `public/`, `src/react-app-env.d.ts`, `src/index.css`
- [x] Delete `src/img/*.png` (replaced by inline SVG, F5)
- [x] `npm i && npm run typecheck` on an empty-ish `src/` before porting logic

(Old React/CRA source — `DrawableCanvas.tsx`, `DrawableCanvasState.tsx`, `components/`,
`lib/`, `index.tsx` — was deleted at this point too, ahead of Phase G's checklist item,
because it blocked `tsc` from typechecking the new `src/` tree. All of it had already
been read in full for porting; nothing was lost.)

### Target `src/` layout

```
src/
  index.ts         FrontendRenderer entry + WeakMap instance registry
  instance.ts      CanvasInstance: fabric canvas lifecycle, data diffing, appliers
  history.ts       undo/redo store - PURE, no fabric, no DOM (Vitest tests this)
  background.ts    background colour + image handling
  toolbar.ts       toolbar DOM + inline SVG icons
  styles.css       toolbar + canvas styles
  tools/
    index.ts fabrictool.ts freedraw.ts line.ts rect.ts
    circle.ts point.ts polygon.ts transform.ts
```

Extracting `history.ts` as a canvas-free, DOM-free module is a requirement, not a
suggestion — it is the only part of the frontend Vitest can meaningfully test (T2), and
it is the payoff for dropping React's `useReducer`.

---

## Phase C — Port the drawing tools to Fabric 7

Source: `src/lib/*.ts`. Target: `src/tools/*.ts`. The tool *logic* is sound and should be
preserved; what changes is the Fabric API surface (risk R4).

Apply to every file:

- [x] `import { fabric } from "fabric"` → named imports:
      `import { Canvas, StaticCanvas, Line, Rect, Circle, Path, Point } from "fabric"`
- [x] `canvas.getPointer(o.e)` → `canvas.getScenePoint(o.e)` — **removed** in v7, present
      in all five tool files. Use `getScenePoint` (scene coordinates, matching what the
      old `getPointer` returned for an untransformed canvas), not `getViewportPoint`
- [x] `canvas.freeDrawingBrush` is no longer auto-instantiated — `freedraw.ts` must
      `canvas.freeDrawingBrush = new PencilBrush(canvas)` before setting `width`/`color`
- [x] Keep every explicit `originX`/`originY` — v7 changes the *defaults* to `center`, and
      these explicit settings are what insulate us. **Verify** each shape renders at the
      expected position rather than assuming
- [x] `strokeUniform`, `noScaleCache`, `selectable`, `evented`, `setCoords()` are unchanged

Per-file notes:

- [x] `freedraw.ts` — brush instantiation, above
- [x] `line.ts` — `getScenePoint`
- [x] `rect.ts` — `getScenePoint`; verify `originX: "left"`, `originY: "top"`
- [x] `circle.ts` — `getScenePoint`; verify `radius`/`angle` behaviour
- [x] `point.ts` — `getScenePoint`; fixed-radius `Circle`
- [x] `polygon.ts` — `getScenePoint`; uses `Line`, `Circle` **and** `Path`. Preserve the
      existing interaction contract: left-click adds a point, right-click closes the
      polygon, double-click removes the most recent point
- [x] `transform.ts` — `getActiveObject()`, double-click to delete
- [x] Preserve `canvas.stopContextMenu = true` and `canvas.fireRightClick = true`. v7
      changes these defaults to `true`, but keep them explicit — the behaviour must not
      depend on a framework default

All seven tools manually verified live in a running Streamlit app (freedraw, line, rect,
circle, point, polygon, transform) via synthetic pointer events with exact geometry
assertions -- see the stage-2 report for the full account. `originX`/`originY` positions
matched expected geometry exactly in every case; no origin-default surprises.

---

## Phase D — Renderer, instance model, history, toolbar

### D1 — The v2 renderer contract

Verified against the Streamlit 1.63 source. Read this carefully; it differs from v1 in
ways that matter.

```ts
import { FrontendRenderer, FrontendRendererArgs } from "@streamlit/component-v2-lib";

const DrawableCanvasRoot: FrontendRenderer<StateShape, DataShape> = (args) => {
  const { data, parentElement, setStateValue, setTriggerValue } = args;
  // ...
  return () => { /* cleanup - fires ONLY on true unmount */ };
};
export default DrawableCanvasRoot;
```

Facts that shape the implementation:

- **There is no iframe.** The component renders inline in Streamlit's DOM (inside a
  shadow root when `isolate_styles=True`). `Streamlit.setFrameHeight()` does not exist,
  and there is **no auto-sizing protocol** — size comes from the Python `width`/`height`
  mount kwargs.
- **The renderer is re-invoked on every data change, and your previous cleanup is *not*
  called first.** Cleanup runs only on true unmount. Re-invocation must therefore be
  idempotent and incremental.
- **`parentElement` is stable** across re-invocations for a given instance, but its
  children are torn down and rebuilt whenever the component's `html`/`css` change. Ours
  are static, so children survive — but **re-`querySelector` on every invocation anyway**;
  never cache a DOM node across calls.
- **`setStateValue(name, value)`** merges into a persisted per-instance JSON widget value
  and triggers a rerun.
- **`setTriggerValue(name, value)`** is one-shot, batched per macrotask, and **silently
  no-ops inside `st.form`**. We do not use it for the payload (P8).
- Streamlit theme values are exposed as `--st-*` CSS custom properties, which **inherit
  through the shadow boundary**.

### D2 — Instance model (F3)

- [x] Module-scoped `const instances = new WeakMap<Element, CanvasInstance>()`
- [x] On invocation: look up `parentElement`; create the instance if absent, otherwise
      reuse it
- [x] `CanvasInstance` owns: the Fabric `Canvas`, the background `StaticCanvas`, the
      history store, the active tool and its cleanup, and the last-applied data snapshot
- [x] Diff incoming `data` against the snapshot and apply only what changed. Follow
      echarts' memoized-generator pattern (`../streamlit-echarts/streamlit_echarts/frontend/src/index.ts`)
- [x] Reloading the canvas from `initialDrawing` must happen **only** when
      `initialDrawing` actually changed — otherwise every unrelated rerun wipes the
      user's in-progress drawing
- [x] The returned cleanup disposes the Fabric canvas, removes listeners, and deletes the
      WeakMap entry

Verified live: undo history and in-progress state survive unrelated reruns (drew on one
canvas, triggered reruns via other canvases, history/toolbar state was untouched); two
canvases on one page do not interfere with each other's tool/history state.

### D3 — History (undo/redo)

- [x] Port `DrawableCanvasState.tsx`'s reducer to a plain `history.ts` store: `save`,
      `undo`, `redo`, `reset`, `canUndo`, `canRedo`, `forceSend`
- [x] **No Fabric imports, no DOM access** — it operates on opaque JSON snapshots
- [x] History lives on the `CanvasInstance` and therefore survives reruns (this is the
      whole point of F3)
- [x] `loadFromJSON` is Promise-based in v7 and now **always defers via a microtask**,
      even when it could complete synchronously. The old callback form sometimes ran
      synchronously. Audit the `resetState` / `saveState` ordering around all three call
      sites — this is a real behavioural difference, not a syntax change
- [x] `canvas.toJSON()` is **no longer an alias of `toObject()`** in v7. State saving
      currently relies on `toJSON()`. Decide per call site which is correct and make it
      explicit; `toObject()` is what produces the full serialization we want

`toObject()` is used everywhere state is captured (`instance.ts`'s `saveAndMaybeSend`,
toolbar send). All three `loadFromJSON` call sites (`initialDrawing` load, undo/redo
reload) are guarded with a per-purpose monotonic generation counter so a stale resolution
can't clobber newer state if a second load starts before the first's microtask settles.

### D4 — Toolbar (F5)

- [x] Rebuild as plain DOM in `toolbar.ts` — undo, redo, download/send, clear
- [x] **Inline SVG** icons, stroked/filled with `currentColor`
- [x] Colour from `var(--st-text-color)`; delete the hardcoded
      `filter: invert(95%) sepia(10%) hue-rotate(184deg)` chains entirely. Dark mode must
      work — it never has
- [x] Disabled state via opacity/`cursor`, not a filter hack
- [x] Preserve behaviour: the clear button empties history *and* pushes a blank state to
      Streamlit even when `update_streamlit=False`
- [x] Respect `displayToolbar`

Verified live: send/undo/redo/reset all work correctly end-to-end (toolbar state
disabled/enabled correctly tracks history); reset always sends regardless of
`update_streamlit`.

### D5 — Background (P6/P7 frontend half)

- [x] Background image is drawn to the separate `StaticCanvas` behind the drawing canvas,
      as today
- [x] The frontend receives a plain URL string — either an ordinary `http(s)` URL or a
      `data:` URI. It does not care which. **Delete `getStreamlitBaseUrl()`** and the
      `streamlitUrl` query-param logic; it was iframe-era plumbing and there is no iframe
- [x] Background colour continues to come through `initialDrawing.background`

**Real bug caught and fixed during manual testing:** the first implementation drew the
background image with raw `ctx.drawImage()` on the `StaticCanvas`'s 2D context. That
canvas is Fabric-managed -- `StaticCanvas` re-renders itself from its own object model
(background image included) on `renderAll()`/`setDimensions()`, and anything drawn by
reaching past that API into the raw context gets silently wiped on the next
Fabric-driven render. Visually this showed as the background image never appearing.
Fixed by switching to Fabric's own `FabricImage.fromURL()` + `backgroundCanvas.
backgroundImage = img` + `renderAll()` -- the supported API for exactly this. Verified
live afterward with a real photo URL.

---

## Phase E — Python v2 API

### E1 — Component registration

- [x] Create the inner manifest `streamlit_drawable_canvas/pyproject.toml`:
      ```toml
      [project]
      name = "streamlit-drawable-canvas"
      version = "0.9.3"        # bumped to 0.10.0 in stage 3

      [[tool.streamlit.component.components]]
      name = "streamlit_drawable_canvas"
      asset_dir = "frontend/build"
      ```
- [x] Add `"pyproject.toml"` to `[tool.setuptools.package-data]` in the root `pyproject.toml`
- [x] Register the component:
      ```python
      out = st.components.v2.component(
          "streamlit-drawable-canvas.streamlit_drawable_canvas",
          js="index-*.js",
          css="index-*.css",  # only if Vite emits one; otherwise omit and inline styles
          html='<div class="canvas-root"></div>',
          isolate_styles=True,
      )
      ```
- [x] Delete the `_RELEASE` flag and both `declare_component` branches
- [x] Delete the `dev-mode` / `release-mode` / `:3001` justfile recipes and
      `export NODE_OPTIONS` (all marked `# DELETE IN STAGE 2` in stage 1)

Vite's lib-mode CSS output doesn't hash-substitute for a secondary asset -- the emitted
file is literally named `index-_hash_.css` (deterministic every build). `css="index-*.css"`
still resolves it fine since the glob matches on the literal text; noted here so it isn't
mistaken for a bug later.

`css=` and `js=` are resolved as `asset_dir`-relative globs that must match **exactly one**
file. `html=` is always treated as literal content — the docstring claims it accepts a
path, but the implementation does not resolve it. Do not pass a path there.

### E2 — `st_canvas` signature

Existing parameters keep their names and defaults exactly (P1). Two are added:

- [x] `return_image_data: bool = False` — controls whether the frontend sends the PNG at
      all (P2). *Name is a routine implementation call; change it only with the
      maintainer's agreement.*
- [x] `on_change: Callable | None = None` — wired to the component's `on_drawing_change`

Behaviour:

- [x] `background_image` accepts a URL string, a path, `bytes`, or a PIL `Image` (P6).
      Only the raw-pixel branches import Pillow. **If a user passes a PIL object they
      demonstrably have Pillow installed** — the optional extra does not break this
- [x] Raw pixels → base64 `data:` URI, **memoized by content hash** (P7). Reuse the
      existing `md5(img.tobytes())` idea for the cache key
- [x] Remove the `st_image.image_to_url` call and the
      `st._config.get_option("server.baseUrlPath")` prefixing entirely
- [x] Mount with `width="content", height="content"` (P9); `width`/`height` stay canvas
      pixel dims passed through `data`
- [x] Every `default=` key must have a matching `on_<key>_change` callback registered, or
      Streamlit raises `BidiComponentInvalidDefaultKeyError`. Only use `default=` for keys
      you have registered
- [x] Fix the live bug: `if component_value is None: return CanvasResult` returns the
      **class**. It must return `CanvasResult()` (P11)

`out(...)` originally omitted `width`/`height`, silently defaulting to `width="stretch"`
(the mount command's own default) instead of `"content"` -- caught while re-reading this
checklist against the code, not from external review. Fixed by passing both explicitly.
`ComponentResult` is never `None` in v2 (always at least `{}`), so P11's literal bug can't
recur; `CanvasResult(...)` is always constructed as a real instance.

### E3 — `CanvasResult` and the optional extra

- [x] Move `Pillow` and `numpy` out of `dependencies` into `[project.optional-dependencies]`
      as `image = ["Pillow", "numpy"]` (P3). Base install becomes `["streamlit >= 1.53"]`
- [x] Raise `requires-python` to `>=3.10`; add trove classifiers as echarts has them
- [x] Accessing `image_data` when `return_image_data=False` must **raise** with a message
      naming both the parameter and the extra (P4). Something like:
      *"image_data was not requested. Pass return_image_data=True to st_canvas(), and
      install the image extra: pip install streamlit-drawable-canvas[image]"*
- [x] Import numpy/Pillow **lazily**, inside the decode path only — a base install must be
      importable without them
- [x] No auto-detection of installed packages (P5)
- [x] Full type annotations; **no `py.typed`** (P10)

---

## Phase F — Tests

### F1 — Vitest (pure logic only, T2)

- [x] `history.test.ts` — save/undo/redo/reset/canUndo/canRedo, boundary conditions.
      27 cases, including `isEmptyValue`/`deepEqual` directly, the empty-current
      re-baseline behaviour, and the `HISTORY_MAX_COUNT` (100) eviction edge case
      where `undo()` reports a reload and duplicates onto redo without actually
      changing `current` (the quirk the module's own docstring calls out)
- [x] Data-diffing helpers — `toolKeyFor` (`instance.ts`) was the only such helper;
      exported it (was module-private) and added `instance.test.ts` asserting it
      changes only on tool-affecting fields and ignores the rest
- [x] Data-URI / hashing helpers if any live frontend-side — none do; that logic is
      entirely server-side (`_encode_bytes_to_data_url` et al. in `__init__.py`), so
      nothing to test here
- [x] **Do not** attempt to instantiate a Fabric canvas in Vitest. jsdom's `<canvas>` has
      no 2D context and adding `node-canvas` is on the do-not list — confirmed:
      `background.ts`'s `applyBackgroundImage` and the rest of `instance.ts` touch
      Fabric/DOM directly and were left untested here; that's Playwright's job (F2)

### F2 — Playwright (T3)

Model on `../streamlit-echarts/e2e_playwright/`. Assert on **`json_data` structure**, not
pixels.

- [x] One test app + test per drawing mode; drive synthetic mouse drags —
      `canvas_modes.py`/`canvas_modes_test.py`, one canvas per `drawing_mode`, results
      read back via a `st.code(json.dumps(...))` block. **Non-obvious finding while
      building this:** Fabric 7's own `toObject()` capitalizes `type` (`"Rect"`, not
      v4's `"rect"`) for objects it creates fresh — but an object *loaded* from JSON
      keeps the source's original casing (see F3 below). Also: real
      `page.mouse.*` events, unlike hand-rolled `dispatchEvent`, cross the shadow
      boundary fine without `composed: true` — that only bit an ad hoc debug script,
      not the actual suite
- [x] Assert the resulting object: `type`, and geometry within a tolerance
      (e.g. a `rect` drag from (100,100) to (200,180) yields
      `type: "rect", left: 100, top: 100, width: 100, height: 80`) — done, with small
      `stroke_width` in the test app so `minLength`/`minRadius` clamping doesn't
      interfere at these drag sizes. Polygon note: a right-click *closes* the path
      from the last left-clicked vertex, it does not add its own position as a
      vertex — two non-collinear left-clicks are needed before closing or the path
      is degenerate (zero height) and the tool's own `width/height !== 0` guard drops
      it silently
- [x] `update_streamlit=False` sends nothing until forced; right-click forces a send —
      `canvas_behavior_test.py::test_update_streamlit_false_gates_sends_until_right_click_forces_one`
- [x] Toolbar: undo, redo, clear — `canvas_toolbar.py`/`canvas_toolbar_test.py`,
      also asserts the undo/redo buttons' `disabled` state at each step
- [x] `initial_drawing` round-trip: output of one canvas loads into another —
      `canvas_behavior_test.py::test_initial_drawing_round_trips_into_another_canvas`.
      **Non-obvious finding:** feeding a new `initial_drawing` prop is not itself
      echoed back as the *other* canvas's returned widget state — state only updates
      on user interaction with that canvas. The toolbar's "Send to Streamlit" button
      exists for exactly this gap; the test (and `fabric_v4_compat_test.py`, F3) uses
      it to force a report after a programmatic load
- [x] `return_image_data=True` populates `image_data`; the default raises on access —
      the populated case is `canvas_behavior_test.py::test_return_image_data_populates_ndarray_shape`
      (end-to-end through the real `image_to_url`/numpy path); the default-raises case
      is exercised directly in `tests/test_init.py` (pure Python, no browser needed)
- [x] Component inside `st.form` still returns the drawing (this is *why* P8 chose state
      over triggers — test it) — `canvas_behavior_test.py::test_canvas_inside_form_only_returns_drawing_on_submit`.
      Confirmed empirically: drawing inside the form does not itself trigger a rerun,
      but the state was already recorded and shows up once `Submit` does trigger one
- [x] Two canvases on one page do not interfere (the WeakMap instance model, F3) —
      `canvas_isolation.py`/`canvas_isolation_test.py::test_two_canvases_do_not_interfere`
- [x] Undo history survives an unrelated widget rerun (also F3 — the regression that would
      otherwise ship silently) — `canvas_isolation_test.py::test_undo_history_survives_an_unrelated_rerun`,
      an unrelated `st.button` triggers a full script rerun and both the drawn objects
      and undo capability are confirmed intact afterward
- [x] Add `.github/workflows/playwright.yml` and `ts-tests.yml` from echarts — adapted
      to this repo's actual tooling (`uv sync --group e2e` instead of pip+venv, Node 24
      per the plan's open-items decision, package dir `streamlit_drawable_canvas`)

### F3 — Fabric v4 JSON compatibility (T5, risk R3)

The reason stage 1 existed.

- [x] For each `e2e_playwright/fixtures/fabric-v4/*.json`: pass it as `initial_drawing`,
      confirm it loads without error and renders
- [x] Assert the loaded object model matches the fixture's — same object count, same
      types, same geometry
- [x] Human review step: compare each Fabric 7 render against its `*.v4-reference.png`
      **by eye, once**. If they match, commit the Fabric 7 render as the snapshot baseline
- [x] **Never pixel-compare v7 output against a v4 reference in an automated test** —
      cross-major rasterization differences will produce false failures. The v4 PNGs are
      human review references only

> **STOP condition R3 — TRIGGERED. Resolved by maintainer.**
>
> All 8 fixtures load without a JS exception or console error. Visual comparison against
> `*.v4-reference.png` (live, in a running app, via `initial_drawing`):
>
> | Fixture | Result |
> |---|---|
> | `line`, `rect`, `polygon`, `freedraw`, `transform` | **Match.** Pixel-plausible match to reference; `transform` (flagged as likeliest to fail, origin semantics) matches exactly — our explicit `originX`/`originY` insulation held. |
> | `circle`, `point` | **FAIL.** Renders as a ~1.7%-of-circle sliver instead of the full shape. |
> | `kitchen-sink` | **Partial FAIL** — its `rect`/`line`/freedraw-`path` objects match; its two `circle`-type objects (one `circle`-mode, one `point`-mode) show the same sliver failure. |
>
> **Root cause (confirmed against Fabric 7's own source, not inferred):** Fabric 4 wrote
> `Circle.startAngle`/`endAngle` in **radians** (`endAngle: 6.283185307179586` = 2π = "full
> circle" in v4's own terms). Fabric 7 redefined these same JSON keys as **degrees**
> (`Circle.d.ts`: *"Angle for the end of the circle, in degrees... @default 360"*).
> `loadFromJSON` doesn't consult the `version` field (as the plan already warned), so it
> takes `6.283185307179586` literally as **6.28 degrees**, drawing a razor-thin arc
> instead of the full disc. `left`/`top`/`width`/`height`/`radius` are unaffected — this is
> narrowly a `startAngle`/`endAngle` unit reinterpretation, nothing else.
>
> **Maintainer's decision (asked live, mid-stage): declare it breaking, no migration
> shim.** Circle and Point objects (the two drawing modes that produce a Fabric `Circle`)
> persisted by streamlit-drawable-canvas <0.10.0 will render incorrectly — a thin sliver,
> not the original shape — if fed back in via `initial_drawing` on 0.10.0+. Line, Rect,
> freedraw (Path), Polygon (Path), and Transform are unaffected; only Circle-type objects
> carry `startAngle`/`endAngle`. This must be called out prominently in the 0.10.0
> `CHANGELOG.md` entry in stage 3 (not yet written — stage 3's job).

---

## Phase G — Cleanup and verification

- [x] Delete `e2e/` entirely — Cypress spec, `cypress.json`, `package.json`, `plugins/`,
      `app_to_test.py` (T7). Replaced `just run`'s target with a new root-level
      `demo_app.py` (small, single-page — mirrors the old fixture app, not
      echarts' multi-page showcase; fixed for the new API: needs
      `return_image_data=True` to read `image_data`)
- [x] Delete `src/DrawableCanvas.tsx`, `src/DrawableCanvasState.tsx`,
      `src/components/`, `src/lib/`, `src/index.tsx` — done earlier in the stage
      (ahead of this checklist item, see Phase B note)
- [x] Update the stage-1 justfile: `test-frontend` → Vitest, drop the v1-only recipes
      (`dev-mode`/`release-mode`/`:3001 dev`/Cypress recipes/`--legacy-peer-deps`).
      Also un-deferred `lint-frontend`/`format-frontend` (stage 1 left them as a
      no-op/prettier-only stub since `frontend/src` didn't exist yet); they now run
      `tsc --noEmit` + prettier. Re-added the `format-ts-js` pre-commit hook stage 1
      explicitly deferred here, matching echarts' pattern
- [x] `just lint` exits 0
- [x] `just test` (Python + Vitest) exits 0 — **found and fixed a real regression
      along the way**: `tests/test_init.py` was broken at collection, unrelated to
      anything in this stage's own diff. `st.components.v2.component(...)`
      (called at module import time in `__init__.py`) needs an active Streamlit
      runtime to resolve its own manifest; `get_bidi_component_manager()` hands
      back a fresh, undiscovered `BidiComponentManager` on every call when no
      runtime is running, so a bare `import streamlit_drawable_canvas` outside a
      running script always raised `StreamlitAPIException`. This predates F1/F2
      (introduced whenever `__init__.py` was rewritten for the v2 API earlier in
      this stage) and wasn't caught until `just test` was actually run here.
      `tests/conftest.py` already carried a one-line breadcrumb pointing at the
      fix (`../streamlit-echarts/tests/conftest.py`'s pattern) but it was never
      applied. Fixed by mocking `st.components.v2.component` at
      `pytest_configure`, mirroring echarts exactly; also fixed the two
      `CanvasResult` tests that still used the old (pre-stage-2) constructor
      signature, and added the "default raises on access" / "populated when
      `return_image_data=True`" cases
- [x] `just build` produces a wheel containing `frontend/build/index-*.js`
- [x] `just e2e` passes — 23/23, including the new F2/F3 suites
- [x] Install the wheel into a clean venv **without** the `[image]` extra; confirm import
      and basic drawing work, and that `image_data` access raises the intended message —
      verified live (import succeeds, canvas renders and draws, RuntimeError message
      as expected)
- [x] Install with `[image]`; confirm `return_image_data=True` yields a numpy array —
      verified live, `(150, 200, 4)` array returned after drawing
- [x] `uv run pre-commit run --all-files` clean
- [x] Run `/code-review` — 10 findings (9 CONFIRMED, 1 PLAUSIBLE). Triage below;
      resuming after compaction should work straight off this list, not re-review.

  **To fix now (real bugs, low-risk mechanical fixes):**
  - [x] `instance.ts` — `onUndo`/`onRedo`/`onReset` call `sendToStreamlit` (which
        reads `image_data` via `canvas.toDataURL`) synchronously right after firing
        an un-awaited `reloadCanvasFromHistory` (`canvas.loadFromJSON(...).then(...)`,
        never awaited). `json_data` is correct (comes from `history.current`, not the
        canvas) but `image_data` is one reload stale. Fix: make
        `reloadCanvasFromHistory` return its promise; `await`/`.then()` it before
        calling `sendToStreamlit` in all three handlers.
  - [x] `instance.ts` mouse:up handler — `saveAndMaybeSend` already sends when
        `changed && realtimeUpdateStreamlit`; right after it, an unconditional
        `if (button === 2) sendToStreamlit(...)` sends **again** for the same state
        with no dedup, double-doing the PNG encode + `setStateValue` round-trip on
        every right-click that also happened to trigger a realtime send. Fix: inline
        one `state`/`changed` computation, send once — force-send on right-click OR
        (changed && realtime), not both.
  - [x] `instance.ts` `mouse:dblclick` (registered once in `createInstance`, always
        *before* any tool's own dblclick handler added later via `reconfigureTool`)
        fires `saveAndMaybeSend` **before** e.g. `transform.ts`'s
        `handleDoubleClick` removes the active object, or `polygon.ts`'s finish
        logic — snapshotting stale state. Fix: defer the instance-level handler's
        body with `queueMicrotask(...)` so same-tick synchronous tool handlers
        (registered on the same event) finish mutating first, regardless of
        listener registration order.
  - [x] `instance.ts` `applyData` — race: if a tool-only-change call (B) lands
        while an `initialDrawing`-change call's (A) `loadFromJSON` is still in
        flight, B synchronously applies its own tool config (correct), but when
        A's promise later resolves it unconditionally re-`reconfigureTool`s using
        **A's stale closed-over `data`**, clobbering B's newer tool config and
        `lastToolKey`. Fix: track `data` on `instance.latest` (alongside
        `realtimeUpdateStreamlit`/`returnImageData`), set it first thing every
        `applyData` call, and have the `loadFromJSON().then()` callback
        reconfigure using `instance.latest.data` instead of its closure's `data`.
        (The one PLAUSIBLE-rated finding — narrow timing window — but the fix is
        cheap and low-risk, so do it anyway.)
  - [x] `background.ts` `FabricImage.fromURL(url)` has no error handling, and its
        caller in `instance.ts` attaches no `.catch` — a failed load (bad bytes,
        unreachable URL) is silently swallowed, and since `lastBackgroundImageURL`
        is set *before* the load settles, the same `background_image` value never
        retries on a later rerun. Fix: `.catch()` the `applyBackgroundImage(...)`
        call in `instance.ts`; on failure (and only if still the latest
        generation), reset `instance.lastBackgroundImageURL = null` so the next
        `applyData` treats it as changed again and retries.
  - [x] `background.ts` / `__init__.py` — `background_image` is no longer scaled to
        canvas dimensions anywhere. `background.ts`'s own comment claims "Python
        has already resized" it, but `__init__.py` dropped the old `_resize_img`
        call entirely; the `st_canvas` docstring still promises "Automatically
        scaled to canvas dimensions." Fix on the **frontend** side (simpler, no
        Pillow dependency, and `backgroundCanvas.width/height` are already known
        at this point): after `FabricImage.fromURL`, set
        `scaleX = backgroundCanvas.width / img.width`,
        `scaleY = backgroundCanvas.height / img.height` alongside the existing
        `left/top/originX/originY`. Update the stale frontend comment too.
  - [x] `__init__.py` docstring for `update_streamlit` — silently doesn't mention
        that `realtimeUpdateStreamlit` is forced off for `drawing_mode="polygon"`
        (`update_streamlit and (drawing_mode != "polygon")`). Fix: document the
        exception and why (an in-progress multi-click polygon isn't a meaningful
        intermediate value; the completed polygon still sends on right-click-close).
  - [x] `__init__.py` `st_canvas` — an unrecognized `drawing_mode` silently falls
        back to freedraw on the frontend (`tools[data.drawingMode] ?? tools.freedraw`)
        with no error anywhere; v1 threw on an invalid tool key. Fix: validate
        `drawing_mode` against the documented literal set in Python and raise
        `ValueError` naming the allowed values, so a typo fails loudly at the API
        boundary instead of silently drawing with the wrong tool.
  - [x] `__init__.py` `_bg_image_cache` — plain unbounded module-level `dict`,
        never evicted; a long-running multi-user server accumulates one entry per
        distinct `background_image` ever seen, for the life of the process. Fix:
        cap it — swap to an `OrderedDict` with a small `maxsize` (e.g. 32),
        `move_to_end` on hit, `popitem(last=False)` when over budget.

  **Deferred pending a design call, then resolved — see "Send debounce" below:**
  - No debounce on `setComponentValue`/`sendToStreamlit`. v1's `UpdateStreamlit.tsx`
    debounced by 200ms; the v2 rewrite sends immediately on every qualifying
    `mouse:up`. A burst of quick shapes now triggers one Streamlit rerun per shape
    instead of one coalesced rerun. Reintroducing this needs a real design call
    (timer ownership/cleanup on dispose, what interval) — flag it in the report,
    don't improvise a value here.
- [x] Apply the "to fix now" list above, re-run `just lint && just test && just e2e`,
      tick each sub-item as done — all green: `just lint` (ruff + tsc + prettier),
      `just test` (5 pytest + 27 vitest), `just build`, `just e2e` (23/23 Playwright)
- [x] Tick every box and commit
- [x] Report: R2 and R3 outcomes explicitly, plus any Fabric 7 behaviour that differs
      (including the debounce-removal note above) — delivered to maintainer in chat

### Opus review pass

Ran `/code-review high` on Opus against the full `feat/components-v2` diff. All 11
findings verified against the code and fixed:

- [x] `mouse:up` snapshot ran before tool listeners, inverting v1 order — a
      click-without-drag in `line` mode sent a phantom 0×0 line to Python and pushed it
      onto the undo stack before `LineTool.onMouseUp` removed it. Deferred via
      `queueMicrotask`, matching the existing `mouse:dblclick` handler
- [x] Background image was never rescaled on canvas resize — added
      `rescaleBackgroundImage`, applied when dimensions change and the URL doesn't
- [x] `update_streamlit` docstring claimed a polygon is sent on double-click. It isn't,
      and shouldn't be: `PolygonTool.onMouseDoubleClick` *removes* the last points;
      only right-click appends `"z"` and closes. Fixed the docstring (and README), not
      the send path
- [x] **`onSend` echoed the Python-supplied JSON, making the whole Fabric 4 compat suite
      vacuous.** `history.current` is the dict Python just sent after
      `history.reset(data.initialDrawing)`, so `fabric_v4_compat_test.py` compared each
      fixture to itself and would have passed even if `loadFromJSON` dropped every
      object — precisely the risk (R3) stage 1 existed to cover. `onSend` now sends
      `canvas.toObject()`. **R3 evidence is only real as of this fix**; see below
- [x] README quickstart raised under the new opt-in `image_data`; also documented
      `background_image` as Pillow-only. Updated, plus the missing `return_image_data`
      / `key` / `on_change` entries and the `[image]` extra
- [x] `data:` URI as `background_image` fell through to `Path(...).read_bytes()`
- [x] `demo_app.py` imported pandas, which is in no dependency group
- [x] `vite.config.ts` nested `esbuild` under `build`, so `drop: ["console"]` was inert.
      Deleted the block rather than relocating it — `minify: "esbuild"` already covers
      the minify flags, and dropping console would have stripped the deliberate
      `console.error` in `background.ts`
- [x] Emitted CSS was literally `index-style.css` with an uninterpolated `[hash]`. Lib
      mode can't hash CSS; set `lib.cssFileName` to a deliberate name that still matches
      the `css="index-*.css"` glob
- [x] `reloadCanvasFromHistory` had no generation guard, unlike `applyData` — two fast
      undos could render the older snapshot. Now shares `loadGeneration`
- [x] Objects regained `selectable`/`evented` after undo/redo/reset, since
      `loadFromJSON` restores Fabric defaults and those paths never re-ran
      `reconfigureTool`. They do now

**R3, re-confirmed against a non-vacuous test.** With the echo removed, all 8 fixtures
still pass the real round-trip (object count and type), so Fabric 7 genuinely loads v4
JSON. The one assertion that flipped was `type == "circle"` → `"Circle"`: re-serialized
by Fabric 7, loaded objects now report the capitalized class name. That is confirmation
the objects are real Fabric 7 instances, not passthrough JSON. The
radians→degrees `startAngle`/`endAngle` break stands as previously decided — declared
breaking, not shimmed.

- [x] `just lint && just test && just build && just e2e` all green after the fixes
      (5 pytest + 27 vitest, 23/23 Playwright)

### Send debounce

Reinstated, closing the one item Phase G deferred for a design call.

**Interval: 200ms, trailing-only — v1 parity** (maintainer decision). Leading+trailing
was the alternative: better feel on an isolated stroke, but two reruns per burst and a
deviation from v1. 200ms is imperceptible against a Streamlit rerun round-trip.

**Not a library.** `lodash.debounce` is ~4KB into a bundle that ships inside the wheel,
plus a runtime dep, for ~15 lines. v1 didn't use it either — it hand-rolled `useDebounce`
and pulled lodash in only for `isEqual`, which v2 already replaced with a JSON-string key.

**v1's stated rationale was wrong and does not carry over.** `UpdateStreamlit.tsx` claimed
it debounced because lines and circles "continuously render while drawing"; `saveState`
only ever fired on `mouse:up`/`mouse:dblclick`, same as v2. What actually made it
necessary was that v1 did `loadFromJSON` into a hidden second canvas plus `toDataURL()`
on *every* send. v2 has no shadow canvas and the PNG encode is behind `return_image_data`,
off by default. The surviving cost is one Streamlit rerun per `mouse:up` — a full
re-execution of the user's script — which is what this coalesces.

- [x] `debounce.ts`: trailing `debounce` + `createSender` (`schedule`/`now`/`cancel`).
      Pure, no Fabric or DOM, so Vitest drives it directly (T2)
- [x] Only the realtime path debounces. Right-click force-send, toolbar send, undo, redo
      and reset all go through `sender.now()`, which **cancels the pending send first** —
      otherwise a snapshot scheduled before a polygon right-click-close lands 200ms on top
      of it and Python's last value is the stale drawing. Same ordering-bug class as the
      `mouse:up` finding above
- [x] `applyData` cancels on `initialDrawing` change, so a pre-load snapshot can't clobber
      the drawing Python just pushed; `disposeInstance` cancels, so no timer fires
      `toObject()` against a disposed canvas after a `key=` remount
- [x] Payload is built at delivery time, so the PNG encode is skipped entirely for
      snapshots a later one coalesced away
- [x] `mouse:up` no longer branches on "did the realtime send already happen" — right-click
      simply always sends immediately, and the cancel makes the count identical
- [x] 11 unit tests, including the cancel-on-immediate ordering and the dispose contract.
      The instance.ts wiring itself is covered by e2e and inspection, not a unit test —
      instantiating a Fabric `Canvas` under jsdom isn't worth it
- [x] `just lint && just test && just build && just e2e` all green
      (5 pytest + 38 vitest, 23/23 Playwright)

### Manual verification

Automated gates never touch `demo_app.py`, and the app was hardcoded to freedraw, so most
of the surface had never been exercised by hand. Mode/param coverage was pulled forward
from stage 3 Phase A (`9697da9`) and the maintainer ran it.

- [x] Every `drawing_mode` draws under Fabric 7
- [x] Polygon right-click closes and sends immediately; double-click removes the last
      points without closing — the corrected semantics, and the debounce-cancellation path
      that had only unit coverage
- [x] Switching mode mid-drawing preserves the drawing (T2 diffing)
- [x] `update_streamlit=False` holds until a right-click or toolbar force-send
- [x] `return_image_data=False` hides the image without raising
- [x] Toolbar undo/redo/reset
- [x] **200ms confirmed as the right interval** by the maintainer — no perceptible lag

One regression caught this way: `demo_app.py` raised `StreamlitDataframeConversionError`
on the second stroke. Fixed in `fd14832`. It was introduced by the review pass's finding 7
— the finding (undeclared pandas import) was correct and verified, but removing the import
also removed an `astype("str")` loop that was a load-bearing Arrow workaround, labelled as
such in the README two lines away. **Verifying a finding is not the same as checking what
a fix deletes alongside it.**

**Do not push, do not open a PR, do not bump the version.** Wait for maintainer sign-off.

---

## Commit shape

1. `Scaffold Vite + Fabric 7 frontend`
2. `Port drawing tools to Fabric 7`
3. `Add reactless v2 renderer with WeakMap instance model`
4. `Extract undo/redo history store`
5. `Rebuild toolbar with inline SVG icons`
6. `Migrate Python API to st.components.v2`
7. `Make image_data opt-in and move Pillow/numpy to an extra`
8. `Add Vitest and Playwright suites`
9. `Verify Fabric 4 JSON fixtures load under Fabric 7`
10. `Remove React, CRA, and Cypress`

---

## Reminders from the do-not list

- No React, in any form, including a toolbar island.
- No `image_to_url` or any other unexported Streamlit internal.
- No `node-canvas`; no Fabric under Vitest.
- No `setTriggerValue` for the drawing payload.
- No `width="stretch"` / responsive canvas.
- No renames of existing `st_canvas` parameters.
- No version bump — that is stage 3.
