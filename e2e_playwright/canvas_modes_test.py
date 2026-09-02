"""E2E Playwright tests for each st_canvas drawing_mode."""

from __future__ import annotations

import json

import pytest
from conftest import wait_for_app_run
from playwright.sync_api import Locator, Page

MODES = ["freedraw", "line", "rect", "circle", "point", "polygon", "transform"]


def _canvas_and_code(app: Page, mode: str) -> tuple[Locator, Locator]:
    index = MODES.index(mode)
    canvas = (
        app.locator("[data-testid=stBidiComponentIsolated]")
        .nth(index)
        .locator("canvas.upper-canvas")
    )
    code = app.locator("[data-testid=stCode]").nth(index)
    return canvas, code


def _read_json(code: Locator) -> dict:
    return json.loads(code.inner_text())


def _drag(page: Page, canvas: Locator, x0, y0, x1, y1, steps=5, button="left"):
    # Below-the-fold canvases need an explicit scroll: raw page.mouse.* events
    # don't auto-scroll the way Locator.click() does (bit us in the stage-1
    # fixture capture script too).
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    assert box is not None
    sx, sy = box["x"] + x0, box["y"] + y0
    ex, ey = box["x"] + x1, box["y"] + y1
    page.mouse.move(sx, sy)
    page.mouse.down(button=button)
    for i in range(1, steps + 1):
        page.mouse.move(sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps)
    page.mouse.up(button=button)


def _click(page: Page, canvas: Locator, x, y, button="left"):
    _drag(page, canvas, x, y, x, y, steps=1, button=button)


def test_freedraw_produces_a_path(app: Page):
    canvas, code = _canvas_and_code(app, "freedraw")
    _drag(app, canvas, 30, 30, 100, 80, steps=10)
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Path"
    assert obj["width"] > 0
    assert obj["height"] > 0


def test_line_geometry(app: Page):
    canvas, code = _canvas_and_code(app, "line")
    _drag(app, canvas, 30, 30, 120, 90)
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Line"
    assert obj["width"] == pytest.approx(90, abs=3)
    assert obj["height"] == pytest.approx(60, abs=3)


def test_rect_geometry(app: Page):
    canvas, code = _canvas_and_code(app, "rect")
    _drag(app, canvas, 50, 50, 150, 130)
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(50, abs=3)
    assert obj["top"] == pytest.approx(50, abs=3)
    assert obj["width"] == pytest.approx(100, abs=3)
    assert obj["height"] == pytest.approx(80, abs=3)


def test_circle_geometry(app: Page):
    canvas, code = _canvas_and_code(app, "circle")
    _drag(app, canvas, 60, 60, 100, 60)  # purely horizontal: radius = 20, angle 0
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Circle"
    assert obj["left"] == pytest.approx(60, abs=3)
    assert obj["top"] == pytest.approx(60, abs=3)
    assert obj["radius"] == pytest.approx(20, abs=3)
    assert obj["angle"] == pytest.approx(0, abs=3)


def test_point_places_a_fixed_radius_circle(app: Page):
    canvas, code = _canvas_and_code(app, "point")
    _click(app, canvas, 80, 80)
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Circle"
    assert obj["radius"] == pytest.approx(3, abs=1)  # point_display_radius default
    assert obj["top"] == pytest.approx(80, abs=3)


def test_polygon_right_click_closes_the_path(app: Page):
    # A right-click closes the path from the last vertex already placed by a
    # left-click -- its own position isn't added as a vertex. Two non-collinear
    # left-clicks are needed so the closed path has nonzero width *and* height.
    canvas, code = _canvas_and_code(app, "polygon")
    _click(app, canvas, 50, 50)
    _click(app, canvas, 120, 100)
    _click(app, canvas, 120, 100, button="right")
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Path"
    assert obj["width"] > 0
    assert obj["height"] > 0


def test_transform_moves_the_seeded_object(app: Page):
    canvas, code = _canvas_and_code(app, "transform")
    # Seeded rect is left=50,top=50,width=60,height=40 -> center (80, 70).
    _drag(app, canvas, 80, 70, 110, 90, steps=10)
    wait_for_app_run(app)

    data = _read_json(code)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(80, abs=3)
    assert obj["top"] == pytest.approx(70, abs=3)
    assert obj["width"] == pytest.approx(60, abs=3)
    assert obj["height"] == pytest.approx(40, abs=3)
