"""E2E Playwright tests for `background_image_fit` (issues #103, #120)."""

from __future__ import annotations

from conftest import component, wait_for_app_run
from playwright.sync_api import Page

STRETCH, CONTAIN, SWITCHABLE = 0, 1, 2

# Reads one pixel from the background layer. enableRetinaScaling is off, so
# the canvas's backing store is 1:1 with its CSS pixels.
_SAMPLE = """
(el, coords) => {
  const ctx = el.getContext('2d');
  const d = ctx.getImageData(coords.x, coords.y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}
"""


def _sample(app: Page, index: int, x: int, y: int) -> dict:
    el = component(app, index).locator("canvas.dc-background-canvas")
    el.scroll_into_view_if_needed()
    el.wait_for(state="attached")
    return el.evaluate(_SAMPLE, {"x": x, "y": y})


def test_stretch_fills_the_whole_canvas(app: Page):
    # Historical behaviour, and still the default: the 100x100 image is
    # scaled to 300x200, so even the far-left column is image.
    app.wait_for_timeout(1000)  # background image load is async
    assert _sample(app, STRETCH, 5, 100)["r"] > 200
    assert _sample(app, STRETCH, 150, 100)["r"] > 200
    assert _sample(app, STRETCH, 295, 100)["r"] > 200


def test_contain_preserves_aspect_ratio_and_centres(app: Page):
    # scale = min(300/100, 200/100) = 2 -> a 200x200 image at left=50.
    # The 50px margins either side must be empty.
    app.wait_for_timeout(1000)
    assert _sample(app, CONTAIN, 5, 100)["a"] == 0, "left margin should be empty"
    assert _sample(app, CONTAIN, 295, 100)["a"] == 0, "right margin should be empty"

    centre = _sample(app, CONTAIN, 150, 100)
    assert centre["r"] > 200, "centre should be the image"
    assert centre["a"] > 0

    # Just inside the left edge of the centred image (x=50..250).
    assert _sample(app, CONTAIN, 60, 100)["r"] > 200


def test_changing_fit_refits_without_refetching(app: Page):
    # The background URL is unchanged across this toggle, so applyData takes
    # the rescale branch rather than reloading the image. If the fit key
    # weren't part of the memoization, the canvas would stay stretched.
    app.wait_for_timeout(1000)
    assert _sample(app, SWITCHABLE, 5, 100)["r"] > 200, "starts stretched"

    app.get_by_test_id("stRadio").get_by_text("contain", exact=True).click()
    wait_for_app_run(app)
    app.wait_for_timeout(500)

    assert _sample(app, SWITCHABLE, 5, 100)["a"] == 0, "margin after switching"
    assert _sample(app, SWITCHABLE, 150, 100)["r"] > 200, "centre still image"

    app.get_by_test_id("stRadio").get_by_text("stretch", exact=True).click()
    wait_for_app_run(app)
    app.wait_for_timeout(500)

    assert _sample(app, SWITCHABLE, 5, 100)["r"] > 200, "back to stretched"
