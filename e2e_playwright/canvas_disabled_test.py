"""E2E Playwright tests for `disabled=True` (issue #140)."""

from __future__ import annotations

import json

from conftest import wait_for_app_run
from playwright.sync_api import Locator, Page, expect

DISABLED, ENABLED = 0, 1


def _canvas(app: Page, index: int) -> Locator:
    c = (
        app.locator("[data-testid=stBidiComponentIsolated]")
        .nth(index)
        .locator("canvas.upper-canvas")
    )
    c.scroll_into_view_if_needed()
    return c


def _read_json(app: Page, index: int) -> dict:
    return json.loads(app.locator("[data-testid=stCode]").nth(index).inner_text())


def _drag(app: Page, canvas: Locator, x0, y0, x1, y1, steps=5) -> None:
    box = canvas.bounding_box()
    assert box is not None
    sx, sy = box["x"] + x0, box["y"] + y0
    ex, ey = box["x"] + x1, box["y"] + y1
    app.mouse.move(sx, sy)
    app.mouse.down()
    for i in range(1, steps + 1):
        app.mouse.move(sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps)
    app.mouse.up()


def test_enabled_control_still_draws(app: Page):
    # Guards the two tests below: if this drag stopped working, their
    # "nothing happened" assertions would pass for the wrong reason.
    canvas = _canvas(app, ENABLED)
    _drag(app, canvas, 150, 120, 250, 170)
    wait_for_app_run(app)

    assert len(_read_json(app, ENABLED)["objects"]) == 2


def test_disabled_canvas_ignores_drawing(app: Page):
    before = _read_json(app, DISABLED)
    assert len(before["objects"]) == 1  # the seed renders

    canvas = _canvas(app, DISABLED)
    _drag(app, canvas, 150, 120, 250, 170)
    app.wait_for_timeout(500)  # no rerun is expected, so don't wait for one

    assert _read_json(app, DISABLED) == before


def test_disabled_canvas_ignores_transform(app: Page):
    # The seeded rect spans (50,50)-(110,90); centre is (80, 70). On an
    # enabled transform canvas this drag would move it.
    before = _read_json(app, DISABLED)

    canvas = _canvas(app, DISABLED)
    _drag(app, canvas, 80, 70, 140, 120)
    app.wait_for_timeout(500)

    assert _read_json(app, DISABLED) == before


def test_disabled_hides_the_toolbar_despite_display_toolbar(app: Page):
    disabled_root = app.locator("[data-testid=stBidiComponentIsolated]").nth(DISABLED)
    enabled_root = app.locator("[data-testid=stBidiComponentIsolated]").nth(ENABLED)

    expect(disabled_root.get_by_label("Reset canvas & history")).to_be_hidden()
    expect(enabled_root.get_by_label("Reset canvas & history")).to_be_visible()
