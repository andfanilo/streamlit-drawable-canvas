# FAQ — reading and troubleshooting `json_data`

`st_canvas` returns a `CanvasResult`. Almost every question filed against this component
is really a question about its `json_data` field, so this page documents that structure
and the handful of behaviours that surprise people.

`json_data` is [Fabric.js](http://fabricjs.com/) canvas JSON — this component does not
invent or reshape it. Feeding it back into another canvas's `initial_drawing` restores the
drawing.

---

## The top level

```json
{
  "version": "7.4.0",
  "objects": [ ... ],
  "background": "#eeeeee"
}
```

One entry in `objects` per drawn shape, in creation order. `background` is the
`background_color` you passed (empty string when a `background_image` is set — an image
takes precedence over a flat colour).

> **Object `type` is capitalized.** Fabric 7 emits `"Rect"`, `"Circle"`, `"Line"`,
> `"Path"`. Fabric 4 — everything saved by `streamlit-drawable-canvas` 0.9.x and earlier —
> emitted `"rect"`, `"circle"`, `"line"`, `"path"`. Code that does `obj["type"] == "rect"`
> against a 0.10.0 payload silently matches nothing. Compare case-insensitively if you
> handle both.

Every object carries the full Fabric property set (`fill`, `stroke`, `strokeWidth`,
`opacity`, `angle`, `flipX`, `visible`, …). The table below lists only the fields that
carry the geometry you probably want.

| `drawing_mode` | `type` | Geometry fields |
|---|---|---|
| `rect` | `Rect` | `left`, `top`, `width`, `height` |
| `circle` | `Circle` | `left`, `top`, `radius`, `angle` |
| `line` | `Line` | `left`, `top`, `width`, `height`, and `x1`/`y1`/`x2`/`y2` |
| `point` | `Circle` | `left`, `top`, `radius` (= your `point_display_radius`) |
| `freedraw` | `Path` | `path` (see below), plus `left`/`top`/`width`/`height` |
| `polygon` | `Path` | `path`, plus `left`/`top`/`width`/`height` |
| `transform` | *(unchanged)* | edits the objects already present |

---

## The one that catches everyone: transform reports `scaleX`/`scaleY`, not a new `width`

Resize a shape in `transform` mode and its `width`/`height` **do not change**. Fabric
records the resize as a scale factor against the original dimensions:

```json
{
  "type": "Rect",
  "width": 120,      // original, unchanged by the resize
  "height": 80,      // original, unchanged by the resize
  "scaleX": 1.42,
  "scaleY": 1.42
}
```

So the on-screen size is:

```python
actual_width  = obj["width"]  * obj["scaleX"]
actual_height = obj["height"] * obj["scaleY"]
```

The same applies to `radius` on a `Circle`. This is Fabric's behaviour, not something
this component can reasonably change — a great deal of code depends on `width` meaning
"the object's intrinsic width".

## `line` coordinates are relative to the object's own centre

A `Line`'s `x1`/`y1`/`x2`/`y2` are **not** canvas coordinates. They are relative to the
line's own centre, so they are frequently negative:

```json
{ "type": "Line", "left": 134, "top": 89, "x1": -115, "y1": -70, "x2": 115, "y2": 70 }
```

For canvas-space endpoints, work from `left`/`top`/`width`/`height` instead — those are
the bounding box, in canvas pixels.

## `freedraw` gives you a smoothed path, not raw pointer samples

`Path.path` is an array of SVG path segments:

```json
"path": [["M", 18.995, 18.995], ["Q", 19, 19, 25, 23], ["Q", 31, 27, 37, 31]]
```

`M` is a move-to (`[cmd, x, y]`); `Q` is a quadratic curve (`[cmd, ctrl_x, ctrl_y, x, y]`),
where the last pair is the endpoint. Fabric smooths the stroke as you draw, so the
original pointer samples are **not** recoverable verbatim. To approximate the stroke as a
point list, take the endpoint of each segment:

```python
points = [(seg[-2], seg[-1]) for seg in obj["path"]]
```

If you need exact click coordinates rather than a smoothed stroke, use
`drawing_mode="point"` and read each object's `left`/`top`.

## Coordinates are in canvas pixels, not source-image pixels

`width`/`height` on `st_canvas` are the canvas's pixel dimensions. A `background_image` is
scaled to fill that canvas, and **no rescaling is applied to coordinates**. If you
displayed a 2000×1500 image on a 600×400 canvas, convert on your side:

```python
scale_x = image.width / canvas_width      # 2000 / 600
scale_y = image.height / canvas_height    # 1500 / 400

x = obj["left"] * scale_x
y = obj["top"]  * scale_y
```

The same applies in reverse when feeding `initial_drawing` from a differently-sized
canvas — the component will not rescale it for you.

If you set `background_image_fit="contain"`, the image no longer fills the canvas, so
the mapping gains an offset. With a canvas of `cw`×`ch` and an image of `iw`×`ih`:

```python
scale = min(cw / iw, ch / ih)
offset_x = (cw - iw * scale) / 2
offset_y = (ch - ih * scale) / 2

image_x = (obj["left"] - offset_x) / scale
image_y = (obj["top"] - offset_y) / scale
```

Coordinates outside the image land outside `0..iw` / `0..ih` — clamp if that matters.

## Bounding boxes exclude the stroke

`left`/`top`/`width`/`height` describe the shape's *path*, not its painted extent. A
stroke straddles that path, so a shape drawn with `stroke_width=20` paints roughly 10px
beyond the reported box on each side. When you are cropping a region from a source image,
that difference is why the crop can look slightly too small — expand by
`strokeWidth / 2` if you want the painted extent.

---

## Behaviours

### How do I delete one shape without pressing undo repeatedly?

Switch to `drawing_mode="transform"` and **double-click** the shape. This is currently
the only in-canvas delete for a single object; the toolbar's bin icon clears everything.

### How do I clear the canvas from Python?

The frontend reloads `initial_drawing` only when it *changes* since the last rerun —
reloading it every time would wipe a drawing in progress. So:

- **Changing** `initial_drawing` (to `None`, or to a payload with an empty `objects`
  list) clears the canvas, because the value differs from what was last applied.
- **Never passing it at all** does not. `initial_drawing=None` resolves to the same empty
  payload on every rerun, nothing changes, and the drawing stays put.

That second case is why "the previous image's boxes are still on the canvas after I
upload a new image" happens — you never passed an `initial_drawing`, so there was no
change for the component to react to. The most reliable fix is to make the widget `key`
depend on the uploaded file, which remounts the component outright:

```python
uploaded = st.file_uploader("image")
canvas_result = st_canvas(
    background_image=uploaded,
    key=f"canvas_{uploaded.name if uploaded else 'empty'}",
)
```

### I only want the finished drawing, not every stroke

Reach for `st.form` before `update_streamlit=False`. They solve different problems, and
the form is almost always the one you want:

```python
with st.form("drawing"):
    result = st_canvas(height=400, width=600, key="canvas")
    submitted = st.form_submit_button("Submit")

if submitted:
    st.write(result.json_data)
```

The canvas keeps `update_streamlit=True`, so it records every stroke as you draw — but
the form holds the rerun back until Submit, and then you read the finished drawing. Your
app's users never have to find a button inside the canvas toolbar, and it still works
with `display_toolbar=False`. The canvas is not a trigger widget, so it never submits the
form on its own.

`update_streamlit=False` is the lower-level tool: it stops the sends themselves. Nothing
reaches Python until something forces a send — the toolbar's first button, a right-click
on the canvas, or the reset button. Use it when you want to suppress traffic (an
expensive rerun, a large `return_image_data` payload) rather than to batch a form. Two
things to know:

- The toolbar stays **pinned open** rather than appearing on hover, since its send button
  is then the only discoverable way to commit a drawing.
- Right-click is not available on touch devices, so don't make it the only path.

### Why doesn't my polygon appear in `json_data`?

A polygon is only sent once it is **closed with a right-click**. Left-click adds a vertex;
double-click removes the most recent ones. `update_streamlit` is ignored in
`drawing_mode="polygon"` for this reason — a half-drawn polygon is not a meaningful value
to send. (This makes polygons impractical on touch devices, which have no right-click.)

### Can I tell a left-click from a right-click?

Not from `json_data`. In `point` mode only a left-click places a point; a right-click
forces a send of whatever is already on the canvas. The distinction is not recorded.

### `image_data` raises `RuntimeError`

It is opt-in as of 0.10.0. Pass `return_image_data=True` and install the extra:

```sh
pip install streamlit-drawable-canvas[image]
```

It PNG-encodes the whole canvas on every send, which is wasted work for the majority of
callers who only read `json_data` — hence the default.

### My saved 0.9.x drawing renders as a thin sliver

Only `circle` and `point` objects, and only from drawings saved by 0.9.x. Fabric 4 wrote
`startAngle`/`endAngle` in radians; Fabric 7 reads those same keys as degrees. There is no
migration shim — see the `[0.10.0]` entry in `CHANGELOG.md`. Every other shape type
(`Line`, `Rect`, `Path`, freedraw, polygon, transform) loads unchanged.

### Can the canvas resize with the browser window?

No. `width`/`height` are fixed canvas pixel dimensions, deliberately: Fabric's coordinates
live in canvas pixel space, so a responsive canvas would make every saved drawing
depend on the viewport it was drawn in. This was considered for 0.10.0 and deliberately
rejected.
