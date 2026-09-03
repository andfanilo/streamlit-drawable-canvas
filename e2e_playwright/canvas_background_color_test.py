"""E2E Playwright tests covering reset with a background image, and the
initial_drawing round-trip propagation fix."""

from __future__ import annotations

from conftest import canvas, component, drag, read_json, wait_for_app_run
from playwright.sync_api import Page

CANVAS1, ROUND_TRIP = 0, 1

# Reads one pixel from the drawing canvas's own raster (its `background`
# fill lives here, distinct from the separately layered background image).
_SAMPLE = """
(el, coords) => {
  const ctx = el.getContext('2d');
  const d = ctx.getImageData(coords.x, coords.y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}
"""


def _sample_drawing_layer(app: Page, index: int, x: int, y: int) -> dict:
    el = component(app, index).locator("canvas.dc-canvas.lower-canvas")
    el.scroll_into_view_if_needed()
    return el.evaluate(_SAMPLE, {"x": x, "y": y})


def test_reset_keeps_the_background_image(app: Page):
    app.get_by_text("background image").click()
    wait_for_app_run(app)

    drag(app, canvas(app, CANVAS1), 20, 20, 100, 60)
    wait_for_app_run(app)

    component(app, CANVAS1).get_by_label("Reset canvas & history").click()
    wait_for_app_run(app)

    assert read_json(app, CANVAS1)["objects"] == []
    # A stale opaque `background` fill on the drawing layer would occlude the
    # background image beneath it; it must stay transparent instead.
    pixel = _sample_drawing_layer(app, CANVAS1, 150, 100)
    assert pixel["a"] == 0


def test_background_image_toggle_propagates_to_round_trip_canvas_immediately(
    app: Page,
):
    drag(app, canvas(app, CANVAS1), 20, 20, 100, 60)
    wait_for_app_run(app)
    assert len(read_json(app, CANVAS1)["objects"]) == 1
    assert len(read_json(app, ROUND_TRIP)["objects"]) == 1

    app.get_by_text("background image").click()
    wait_for_app_run(app)

    assert read_json(app, CANVAS1)["objects"] == []
    # No further draw action -- the reload must propagate on its own.
    assert read_json(app, ROUND_TRIP)["objects"] == []
