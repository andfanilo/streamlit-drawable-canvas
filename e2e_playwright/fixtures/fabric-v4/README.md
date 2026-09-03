# Fabric 4 JSON fixtures

Ground-truth captures of what Fabric.js **4.4.0** (this component's pinned frontend
version, as of `streamlit-drawable-canvas` 0.9.3) actually produces for each
`drawing_mode`. Captured 2026-09-02, on Node 16.20.2, by driving the then-current Fabric 4
frontend with synthetic Playwright mouse events at the coordinates documented below.

## Why these exist

Users have `initial_drawing` / `json_data` payloads persisted by Fabric 4.4.0 that they
cannot regenerate. Fabric publishes no cross-major JSON compatibility guarantee, and
`loadFromJSON` does not consult the `version` field. Stage 2 (the move to Fabric 7) must
prove real v4 output still loads correctly under v7 — that proof needs real v4 output as
its input. These fixtures are that input, and the compatibility outcome they established
is recorded in `CHANGELOG.md`'s `[0.10.0]` entry.

## Two kinds of artifact — do not confuse them

| Artifact | Role |
|---|---|
| `*.json` | **Test input. Ground truth.** Committed, never regenerated. This is what stage 2's snapshot/load tests assert against. |
| `*.v4-reference.png` | **Human review reference only.** |

The PNGs are **not** automated assertions. Do not write a test that pixel-compares a
Fabric 7 render against a Fabric 4 render — cross-major antialiasing and rasterization
differences will produce false failures even when the load is semantically perfect.

Their actual role, in stage 2: a human looks at the Fabric 7 render beside the
`v4-reference.png` **once**, confirms they visually match (same shape, position, color,
rotation), and blesses the Fabric 7 render as the committed snapshot baseline going
forward. **From that point on, snapshot tests compare v7 against v7** — the v4 PNGs are
never touched again after that one bless step.

## Provenance

- Fabric.js: `4.4.0` (pinned in `streamlit_drawable_canvas/frontend/package.json`)
- Component version at capture time: `0.9.3`
- Node.js: `16.20.2` (required to build `react-scripts@4` — see `AGENTS.md`)
- Capture date: 2026-09-02
- Capture tooling: `scripts/capture_v4_fixtures.py` + `e2e_playwright/fixtures/capture_app.py`

**The capture tooling has been deleted.** It could only ever run against the Fabric 4
frontend, which stage 2 removed, so it was unrunnable from that point on. Recover it from
git history (`git log -- scripts/capture_v4_fixtures.py`) if the exact mechanics are ever
needed; the coordinates it used are documented per fixture below, which is what actually
matters for reading a fixture.

The `.json` fixtures cannot be regenerated. Neither can the `.v4-reference.png` files —
they are kept for that reason, even though their one-time visual bless step is done.

All canvases are `300x200` px, `background_color="#eeeeee"` unless noted.
Coordinates below are canvas-local (top-left origin), matching what the capture script
passes to Playwright's `page.mouse` after resolving each canvas's on-page bounding box.

## Fixtures

### `freedraw.json`

`drawing_mode="freedraw"`, `stroke_width=5`, `stroke_color="#000000"`. One continuous
drag through the points (in order): `(20,20) → (80,60) → (140,20) → (200,80) →
(260,40)`. Produces a single `Path` object.

### `line.json`

`drawing_mode="line"`, `stroke_width=3`, `stroke_color="#0000ff"`. Single drag from
`(20,20)` to `(250,160)`. Produces a `Line`.

### `rect.json`

`drawing_mode="rect"`, `stroke_width=3`, `stroke_color="#ff0000"`,
`fill_color="rgba(255,0,0,0.3)"`. Single drag from `(30,30)` to `(220,150)`. Produces a
`Rect`.

### `circle.json`

`drawing_mode="circle"`, `stroke_width=3`, `stroke_color="#008000"`,
`fill_color="rgba(0,128,0,0.3)"`. Single drag from `(50,40)` to `(180,150)`. Produces a
`Circle`. Note its captured `angle` (≈40.24°) is not 0 — that comes from Fabric's own
circle-tool math for a non-square drag bounding box, not from any transform step; worth
knowing when eyeballing the render.

`rect.json`, `circle.json`, `line.json`, and `freedraw.json` all use `update_streamlit`'s
default (`True`), so state syncs on every `mouse:up`.

### `point.json`

`drawing_mode="point"`, `point_display_radius=8`, `stroke_color="#800080"`. Single click
(mouse down + up, no drag) at `(150,100)`. Produces a small `Circle` (radius 8).

### `polygon.json`

`drawing_mode="polygon"`, `stroke_width=3`, `stroke_color="#ff8c00"`,
`fill_color="rgba(255,140,0,0.3)"`. Left-clicks at `(50,30)`, `(250,30)`, `(250,170)`,
`(50,170)` (one per vertex, 100ms apart), then a **right-click** back at `(50,30)` to
close. Produces a `Path` (Fabric's polygon tool builds a closed SVG path string, not a
`Polygon` object — see `lib/polygon.ts`). The right-click both closes the shape and
forces a state sync regardless of `update_streamlit` (see
`DrawableCanvas.tsx`'s `mouse:up` handler, the `e.button === 3` branch).

### `transform.json`

Exercises `angle`, `scaleX`/`scaleY`, and `originX`/`originY` semantics — the fixture
most likely to expose Fabric 7's changed origin defaults (risk R3). Sequence, all on one
canvas (`key="transform"`), with a `st.selectbox` toggling `drawing_mode` between
`"rect"` and `"transform"`:

1. `drawing_mode="rect"`: drag `(40,40) → (160,120)` to draw an 120×80 rect.
2. Switch `drawing_mode` to `"transform"`.
3. **Move**: drag from the rect's center `(100,80)` to `(150,110)` (translate by
   `(+50,+30)`).
4. **Scale**: drag the bottom-right corner control, now at `(210,150)`, out to
   `(260,190)`. Fabric's corner drag changes `scaleX`/`scaleY`, not `width`/`height`,
   with the opposite (top-left) corner anchored.
5. **Rotate**: drag the rotation handle, now at `(175,30)` (top-center, 40px above the
   top edge — Fabric 4's default `rotatingPointOffset`), to `(230,10)`.
6. Click an empty area of the canvas, `(10,190)`, to deselect before the PNG capture —
   without this the reference PNG would show Fabric's selection handles, which a
   freshly `loadFromJSON`'d (unselected) object in stage 2 won't have.

Captured result: `scaleX = scaleY = 1.42`, `angle ≈ 25.24°`, `originX/originY = "left"/"top"`.

### `kitchen-sink.json`

Every Fabric object **type** this component produces, on one canvas
(`key="kitchen_sink"`), `background_color="#87ceeb"` (sky blue, to also exercise a
non-default background). A `st.selectbox` toggles `drawing_mode` between each step;
object positions are chosen not to overlap:

1. `drawing_mode="rect"` (default): drag `(20,20) → (90,80)`.
2. Switch to `"circle"`: drag `(110,20) → (180,80)`.
3. Switch to `"line"`: drag `(200,20) → (280,80)`.
4. Switch to `"freedraw"`: drag through `(20,110) → (60,140) → (100,110) → (140,140)`.
5. Switch to `"point"`: click at `(170,120)`.
6. Switch to `"transform"`: drag the rect (added in step 1) from `(55,50)` to `(65,60)`
   — a small nudge, just enough to also exercise `angle`/`scaleX`/`scaleY` alongside the
   other shape types in the same fixture.
7. Click an empty area, `(280,180)`, to deselect before the PNG capture.

Result: 5 objects — `rect`, `circle`, `line`, `path` (freedraw), `circle` (point) — types
that, together with `transform.json`'s transformed `rect`, cover every Fabric JSON shape
this component's tools emit (`polygon.json` also produces `type: "path"`, so it adds no
new schema beyond what `freedraw.json`/`kitchen-sink.json` already cover).

## Sanity-checking a fixture by eye

Each `*.json` was checked for: `version: "4.4.0"` present, the expected `objects[].type`,
and plausible `left`/`top`/`width`/`height`/`radius`/`path`/`angle` values matching the
coordinates documented above. Each `*.v4-reference.png` was checked against its `.json`
to confirm the shape, color, and (for `transform.json`) rotation match.
