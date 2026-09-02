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

- [ ] Minimal spike: a v2 component with `isolate_styles=True`, a Fabric 7 canvas inside
      it, and a freedraw brush
- [ ] Draw near each corner and near the centre; confirm the stroke lands under the cursor
- [ ] Confirm with the app scrolled, and with the component inside `st.columns` and
      `st.expander` (offset parents are where this breaks if it breaks)
- [ ] Record the result in your report either way

> **STOP condition R2.** If pointer coordinates are wrong inside the shadow root and
> there is no clean fix, **stop and report**. The fallback is `isolate_styles=False`, but
> that reverses a settled decision (F4) and the maintainer makes that call. Do not switch
> unilaterally.

---

## Phase B — Frontend scaffolding

Copy from `../streamlit-echarts/streamlit_echarts/frontend/` and adapt.

- [ ] Rewrite `package.json`: `"type": "module"`, scripts
      (`build`/`build:frontend:production`/`clean`/`dev`/`format`/`test`/`test:watch`/`typecheck`)
  - dependencies: `@streamlit/component-v2-lib ^0.2.0`, `fabric ^7.4.0`
  - devDependencies: `vite ^8`, `typescript ^5.8`, `vitest ^4`, `@vitest/coverage-v8`,
    `jsdom`, `prettier`, `rimraf`, `cross-env`, `esbuild`, `@types/node`
  - **Remove** `@types/fabric` — Fabric 7 ships its own types
  - **Remove** react, react-dom, react-scripts, apache-arrow, hoist-non-react-statics,
    event-target-shim, lodash and their `@types`
- [ ] `vite.config.ts` from echarts — library mode, `formats: ["es"]`,
      `fileName: "index-[hash]"`, `outDir: "build"`, `base: "./"`
- [ ] `tsconfig.json` from echarts (`moduleResolution: "bundler"`, `types: ["vite/client"]`)
- [ ] `vitest.config.ts` from echarts (jsdom environment)
- [ ] Delete `.env`, `public/`, `src/react-app-env.d.ts`, `src/index.css`
- [ ] Delete `src/img/*.png` (replaced by inline SVG, F5)
- [ ] `npm i && npm run typecheck` on an empty-ish `src/` before porting logic

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

- [ ] `import { fabric } from "fabric"` → named imports:
      `import { Canvas, StaticCanvas, Line, Rect, Circle, Path, Point } from "fabric"`
- [ ] `canvas.getPointer(o.e)` → `canvas.getScenePoint(o.e)` — **removed** in v7, present
      in all five tool files. Use `getScenePoint` (scene coordinates, matching what the
      old `getPointer` returned for an untransformed canvas), not `getViewportPoint`
- [ ] `canvas.freeDrawingBrush` is no longer auto-instantiated — `freedraw.ts` must
      `canvas.freeDrawingBrush = new PencilBrush(canvas)` before setting `width`/`color`
- [ ] Keep every explicit `originX`/`originY` — v7 changes the *defaults* to `center`, and
      these explicit settings are what insulate us. **Verify** each shape renders at the
      expected position rather than assuming
- [ ] `strokeUniform`, `noScaleCache`, `selectable`, `evented`, `setCoords()` are unchanged

Per-file notes:

- [ ] `freedraw.ts` — brush instantiation, above
- [ ] `line.ts` — `getScenePoint`
- [ ] `rect.ts` — `getScenePoint`; verify `originX: "left"`, `originY: "top"`
- [ ] `circle.ts` — `getScenePoint`; verify `radius`/`angle` behaviour
- [ ] `point.ts` — `getScenePoint`; fixed-radius `Circle`
- [ ] `polygon.ts` — `getScenePoint`; uses `Line`, `Circle` **and** `Path`. Preserve the
      existing interaction contract: left-click adds a point, right-click closes the
      polygon, double-click removes the most recent point
- [ ] `transform.ts` — `getActiveObject()`, double-click to delete
- [ ] Preserve `canvas.stopContextMenu = true` and `canvas.fireRightClick = true`. v7
      changes these defaults to `true`, but keep them explicit — the behaviour must not
      depend on a framework default

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

- [ ] Module-scoped `const instances = new WeakMap<Element, CanvasInstance>()`
- [ ] On invocation: look up `parentElement`; create the instance if absent, otherwise
      reuse it
- [ ] `CanvasInstance` owns: the Fabric `Canvas`, the background `StaticCanvas`, the
      history store, the active tool and its cleanup, and the last-applied data snapshot
- [ ] Diff incoming `data` against the snapshot and apply only what changed. Follow
      echarts' memoized-generator pattern (`../streamlit-echarts/streamlit_echarts/frontend/src/index.ts`)
- [ ] Reloading the canvas from `initialDrawing` must happen **only** when
      `initialDrawing` actually changed — otherwise every unrelated rerun wipes the
      user's in-progress drawing
- [ ] The returned cleanup disposes the Fabric canvas, removes listeners, and deletes the
      WeakMap entry

### D3 — History (undo/redo)

- [ ] Port `DrawableCanvasState.tsx`'s reducer to a plain `history.ts` store: `save`,
      `undo`, `redo`, `reset`, `canUndo`, `canRedo`, `forceSend`
- [ ] **No Fabric imports, no DOM access** — it operates on opaque JSON snapshots
- [ ] History lives on the `CanvasInstance` and therefore survives reruns (this is the
      whole point of F3)
- [ ] `loadFromJSON` is Promise-based in v7 and now **always defers via a microtask**,
      even when it could complete synchronously. The old callback form sometimes ran
      synchronously. Audit the `resetState` / `saveState` ordering around all three call
      sites — this is a real behavioural difference, not a syntax change
- [ ] `canvas.toJSON()` is **no longer an alias of `toObject()`** in v7. State saving
      currently relies on `toJSON()`. Decide per call site which is correct and make it
      explicit; `toObject()` is what produces the full serialization we want

### D4 — Toolbar (F5)

- [ ] Rebuild as plain DOM in `toolbar.ts` — undo, redo, download/send, clear
- [ ] **Inline SVG** icons, stroked/filled with `currentColor`
- [ ] Colour from `var(--st-text-color)`; delete the hardcoded
      `filter: invert(95%) sepia(10%) hue-rotate(184deg)` chains entirely. Dark mode must
      work — it never has
- [ ] Disabled state via opacity/`cursor`, not a filter hack
- [ ] Preserve behaviour: the clear button empties history *and* pushes a blank state to
      Streamlit even when `update_streamlit=False`
- [ ] Respect `displayToolbar`

### D5 — Background (P6/P7 frontend half)

- [ ] Background image is drawn to the separate `StaticCanvas` behind the drawing canvas,
      as today
- [ ] The frontend receives a plain URL string — either an ordinary `http(s)` URL or a
      `data:` URI. It does not care which. **Delete `getStreamlitBaseUrl()`** and the
      `streamlitUrl` query-param logic; it was iframe-era plumbing and there is no iframe
- [ ] Background colour continues to come through `initialDrawing.background`

---

## Phase E — Python v2 API

### E1 — Component registration

- [ ] Create the inner manifest `streamlit_drawable_canvas/pyproject.toml`:
      ```toml
      [project]
      name = "streamlit-drawable-canvas"
      version = "0.9.3"        # bumped to 0.10.0 in stage 3

      [[tool.streamlit.component.components]]
      name = "streamlit_drawable_canvas"
      asset_dir = "frontend/build"
      ```
- [ ] Add `"pyproject.toml"` to `[tool.setuptools.package-data]` in the root `pyproject.toml`
- [ ] Register the component:
      ```python
      out = st.components.v2.component(
          "streamlit-drawable-canvas.streamlit_drawable_canvas",
          js="index-*.js",
          css="index-*.css",   # only if Vite emits one; otherwise omit and inline styles
          html='<div class="canvas-root"></div>',
          isolate_styles=True,
      )
      ```
- [ ] Delete the `_RELEASE` flag and both `declare_component` branches
- [ ] Delete the `dev-mode` / `release-mode` / `:3001` justfile recipes and
      `export NODE_OPTIONS` (all marked `# DELETE IN STAGE 2` in stage 1)

`css=` and `js=` are resolved as `asset_dir`-relative globs that must match **exactly one**
file. `html=` is always treated as literal content — the docstring claims it accepts a
path, but the implementation does not resolve it. Do not pass a path there.

### E2 — `st_canvas` signature

Existing parameters keep their names and defaults exactly (P1). Two are added:

- [ ] `return_image_data: bool = False` — controls whether the frontend sends the PNG at
      all (P2). *Name is a routine implementation call; change it only with the
      maintainer's agreement.*
- [ ] `on_change: Callable | None = None` — wired to the component's `on_drawing_change`

Behaviour:

- [ ] `background_image` accepts a URL string, a path, `bytes`, or a PIL `Image` (P6).
      Only the raw-pixel branches import Pillow. **If a user passes a PIL object they
      demonstrably have Pillow installed** — the optional extra does not break this
- [ ] Raw pixels → base64 `data:` URI, **memoized by content hash** (P7). Reuse the
      existing `md5(img.tobytes())` idea for the cache key
- [ ] Remove the `st_image.image_to_url` call and the
      `st._config.get_option("server.baseUrlPath")` prefixing entirely
- [ ] Mount with `width="content", height="content"` (P9); `width`/`height` stay canvas
      pixel dims passed through `data`
- [ ] Every `default=` key must have a matching `on_<key>_change` callback registered, or
      Streamlit raises `BidiComponentInvalidDefaultKeyError`. Only use `default=` for keys
      you have registered
- [ ] Fix the live bug: `if component_value is None: return CanvasResult` returns the
      **class**. It must return `CanvasResult()` (P11)

### E3 — `CanvasResult` and the optional extra

- [ ] Move `Pillow` and `numpy` out of `dependencies` into `[project.optional-dependencies]`
      as `image = ["Pillow", "numpy"]` (P3). Base install becomes `["streamlit >= 1.53"]`
- [ ] Raise `requires-python` to `>=3.10`; add trove classifiers as echarts has them
- [ ] Accessing `image_data` when `return_image_data=False` must **raise** with a message
      naming both the parameter and the extra (P4). Something like:
      *"image_data was not requested. Pass return_image_data=True to st_canvas(), and
      install the image extra: pip install streamlit-drawable-canvas[image]"*
- [ ] Import numpy/Pillow **lazily**, inside the decode path only — a base install must be
      importable without them
- [ ] No auto-detection of installed packages (P5)
- [ ] Full type annotations; **no `py.typed`** (P10)

---

## Phase F — Tests

### F1 — Vitest (pure logic only, T2)

- [ ] `history.test.ts` — save/undo/redo/reset/canUndo/canRedo, boundary conditions
- [ ] Data-diffing helpers
- [ ] Data-URI / hashing helpers if any live frontend-side
- [ ] **Do not** attempt to instantiate a Fabric canvas in Vitest. jsdom's `<canvas>` has
      no 2D context and adding `node-canvas` is on the do-not list

### F2 — Playwright (T3)

Model on `../streamlit-echarts/e2e_playwright/`. Assert on **`json_data` structure**, not
pixels.

- [ ] One test app + test per drawing mode; drive synthetic mouse drags
- [ ] Assert the resulting object: `type`, and geometry within a tolerance
      (e.g. a `rect` drag from (100,100) to (200,180) yields
      `type: "rect", left: 100, top: 100, width: 100, height: 80`)
- [ ] `update_streamlit=False` sends nothing until forced; right-click forces a send
- [ ] Toolbar: undo, redo, clear
- [ ] `initial_drawing` round-trip: output of one canvas loads into another
- [ ] `return_image_data=True` populates `image_data`; the default raises on access
- [ ] Component inside `st.form` still returns the drawing (this is *why* P8 chose state
      over triggers — test it)
- [ ] Two canvases on one page do not interfere (the WeakMap instance model, F3)
- [ ] Undo history survives an unrelated widget rerun (also F3 — the regression that would
      otherwise ship silently)
- [ ] Add `.github/workflows/playwright.yml` and `ts-tests.yml` from echarts

### F3 — Fabric v4 JSON compatibility (T5, risk R3)

The reason stage 1 existed.

- [ ] For each `e2e_playwright/fixtures/fabric-v4/*.json`: pass it as `initial_drawing`,
      confirm it loads without error and renders
- [ ] Assert the loaded object model matches the fixture's — same object count, same
      types, same geometry
- [ ] Human review step: compare each Fabric 7 render against its `*.v4-reference.png`
      **by eye, once**. If they match, commit the Fabric 7 render as the snapshot baseline
- [ ] **Never pixel-compare v7 output against a v4 reference in an automated test** —
      cross-major rasterization differences will produce false failures. The v4 PNGs are
      human review references only

> **STOP condition R3.** If a fixture fails to load, or renders visibly differently, stop
> and report which fixture and how. The choice between a version-sniffing migration shim
> and declaring the format breaking was explicitly deferred to the maintainer. The
> `transform` fixture (rotation + scaling + origin semantics) is the likeliest to fail.

---

## Phase G — Cleanup and verification

- [ ] Delete `e2e/` entirely — Cypress spec, `cypress.json`, `package.json`, `plugins/`,
      `app_to_test.py` (T7)
- [ ] Delete `src/DrawableCanvas.tsx`, `src/DrawableCanvasState.tsx`,
      `src/components/`, `src/lib/`, `src/index.tsx`
- [ ] Update the stage-1 justfile: `test-frontend` → Vitest, drop the v1-only recipes
- [ ] `just lint` exits 0
- [ ] `just test` (Python + Vitest) exits 0
- [ ] `just build` produces a wheel containing `frontend/build/index-*.js`
- [ ] `just e2e` passes
- [ ] Install the wheel into a clean venv **without** the `[image]` extra; confirm import
      and basic drawing work, and that `image_data` access raises the intended message
- [ ] Install with `[image]`; confirm `return_image_data=True` yields a numpy array
- [ ] `uv run pre-commit run --all-files` clean
- [ ] Run `/code-review`
- [ ] Tick every box and commit
- [ ] Report: R2 and R3 outcomes explicitly, plus any Fabric 7 behaviour that differs

**Do not push, do not open a PR, do not bump the version.** Wait for maintainer sign-off
**and the Opus review pass**.

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
