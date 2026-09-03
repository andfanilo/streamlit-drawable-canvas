# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-09-03

Rebuilt on **Streamlit Components v2** and **Fabric.js 7** (from Fabric.js 4.4.0),
replacing the React 16 / CRA v1 frontend. See
`docs/plans/v2-migration/00-plan.md` for the full decision log.

### Breaking

- **`image_data` is now opt-in.** Pass `return_image_data=True` to `st_canvas()`;
  accessing `image_data` without it raises `RuntimeError`. `Pillow` and `numpy` moved
  out of the base install into the `[image]` extra: `pip install streamlit-drawable-canvas[image]`.
- **Minimum Streamlit is now 1.53; minimum Python is now 3.10.**
- **`background_image` works again**, and is widened to accept a URL, `data:` URI, local
  path, raw bytes, or a PIL Image -- the same inputs `st.image` accepts. It was broken on
  Streamlit >= ~1.5x because it called a private Streamlit API
  (`streamlit.elements.image.image_to_url`) that had moved and changed signature; the
  new implementation resolves images entirely on the Python side, with no private APIs.
- **Object `type` in `json_data` is now capitalized.** Fabric 7 emits `"Rect"`,
  `"Circle"`, `"Line"`, `"Path"`; Fabric 4 emitted `"rect"`, `"circle"`, `"line"`,
  `"path"`. Code that branches on `obj["type"] == "rect"` does not error -- it silently
  stops matching. Compare case-insensitively if you handle payloads from both versions.
- **Saved drawings from 0.9.x with `circle` or `point` objects render as a thin sliver,
  not the original shape**, when fed back in via `initial_drawing`. Fabric 4 wrote
  `Circle.startAngle`/`endAngle` in radians; Fabric 7 reinterprets those same JSON keys
  as degrees, and `loadFromJSON` doesn't consult the JSON's `version` field to tell the
  difference. Declared breaking, with no migration shim. Line, Rect, freedraw, Polygon,
  and Transform objects are unaffected.
- An unrecognized `drawing_mode` now raises `ValueError` instead of silently falling
  back to `"freedraw"`.

### Added

- `on_change`: an optional callback invoked when the component sends a new drawing.
- `background_image_fit`: `"stretch"` (default, the historical behaviour) or `"contain"`,
  which preserves the background image's aspect ratio and centres it inside the canvas
  rather than distorting it to fill. Makes a canvas larger than its background image
  usable, and lets an image keep its proportions.
- `disabled`: renders the canvas read-only. Drawing, selection and transforms are inert,
  nothing is sent back to Streamlit, and the toolbar is hidden regardless of
  `display_toolbar` -- undo/redo/reset would otherwise let a viewer mutate a canvas that
  is meant to be read-only. `initial_drawing` still renders.
- The toolbar now supports dark mode -- icons are inline SVG on `currentColor`, replacing
  the old recolored PNGs.
- The component renders without an iframe (Streamlit Components v2), and undo/redo
  history now survives an unrelated widget rerun.
- `FAQ.md`: a reference for the `json_data` structure and the behaviours that most
  often trip people up -- `scaleX`/`scaleY` after a transform, centre-relative `Line`
  coordinates, the smoothed `freedraw` path, canvas-versus-source-image coordinates,
  and how to clear the canvas from Python.

### Fixed

- `CanvasResult` was returned as the class itself rather than an instance when the
  component had no value yet.

## [0.9.2] - 2022-09-08

- Fix background image on Streamlit Cloud and remote servers (thanks @andreaferretti)

## [0.9.0] - 2022-02-26

- New `point` mode (thanks @arnauddhaene):
  - Adds fixed-radius points to build scatter plots
- Images between frontend and backend are now transferred with URLs computed by Streamlit (thanks @kapong)
- Upgrade `streamlit-component-lib` to 1.3.0

## [0.8.0] - 2021-06-06

- New `polygon` drawing mode (thanks @hiankun):
  - left-click will add point
  - right click will close polygon
  - double click will remove latest point
- the Bin button in the toolbar which deletes the canvas content will now empty the history and send back to Streamlit a blank state, even if `update_streamlit` is set to `False`.
- Right-click fires the `send canvas data back to Streamlit` event for all tools (not only the `polygon`) even if `update_streamlit` is set to `False`.

## [0.7.0] - 2021-05-14

- `initial_drawing` is now used as the initial canvas state. If `None` provided then we create one on the Python side. This provokes the following changes:
  - a change in `background_color` will reset the drawing.
  - `background_color` will override the background color present in `initial_drawing`.
  - if `background_image` is present then `background_color` is removed from `st_canvas` call.
- Upgrade Fabric.js to version 4.4.0.
- Toolbar is now on the bottom left to account for large canvas width.
- Add argument to make the toolbar invisible.
- Make `stroke_width` the minimum size constraint to create a rectangle and circle. Thanks [hiankun](https://github.com/hiankun) for the PR!

## [0.6.0] - 2021-01-30

- Add `initial_drawing` argument to initialize canvas with an exported canvas state

## [0.5.2] - 2021-01-23

- Fix state issue with deleting an object through double click

## [0.5.1] - 2020-10-13

- Add undo/redo/clear buttons
- Add "Send to Streamlit" button for when "Realtime update" is disabled

## [0.4.0] - 2020-09-04

- Add Circle tool
- Add argument to fetch data back to Streamlit on demand

## [0.3.0] - 2020-08-27

### Added

- Add Rectangle tool
- Return JSON representation of canvas to Streamlit
- Add background image behind canvas

## [0.2.0] - 2020-08-20

### Added

- Add drawing of straight lines

### Changed

- API entrypoint for "drawing_mode" is now of type string

## [0.1.1] - 2020-07-14

- Disable Retina scaling

## [0.1.0] - 2020-07-06

- Drawable canvas widget
