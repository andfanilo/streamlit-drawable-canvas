"""E2E Playwright tests for each st_canvas drawing_mode."""

from __future__ import annotations

import pytest
from conftest import canvas, click, drag, read_json, wait_for_app_run
from playwright.sync_api import Page

MODES = ["freedraw", "line", "rect", "circle", "point", "polygon", "transform"]


def test_freedraw_produces_a_path(app: Page):
    index = MODES.index("freedraw")
    target = canvas(app, index)
    drag(app, target, 30, 30, 100, 80, steps=10)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Path"
    assert obj["width"] > 0
    assert obj["height"] > 0


def test_line_geometry(app: Page):
    index = MODES.index("line")
    target = canvas(app, index)
    drag(app, target, 30, 30, 120, 90)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Line"
    assert obj["width"] == pytest.approx(90, abs=3)
    assert obj["height"] == pytest.approx(60, abs=3)


def test_rect_geometry(app: Page):
    index = MODES.index("rect")
    target = canvas(app, index)
    drag(app, target, 50, 50, 150, 130)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(50, abs=3)
    assert obj["top"] == pytest.approx(50, abs=3)
    assert obj["width"] == pytest.approx(100, abs=3)
    assert obj["height"] == pytest.approx(80, abs=3)


def test_circle_geometry(app: Page):
    index = MODES.index("circle")
    target = canvas(app, index)
    drag(app, target, 60, 60, 100, 60)  # purely horizontal: radius = 20, angle 0
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Circle"
    assert obj["left"] == pytest.approx(60, abs=3)
    assert obj["top"] == pytest.approx(60, abs=3)
    assert obj["radius"] == pytest.approx(20, abs=3)
    assert obj["angle"] == pytest.approx(0, abs=3)


def test_point_places_a_fixed_radius_circle(app: Page):
    index = MODES.index("point")
    target = canvas(app, index)
    click(app, target, 80, 80)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Circle"
    assert obj["radius"] == pytest.approx(3, abs=1)  # point_display_radius default
    assert obj["top"] == pytest.approx(80, abs=3)


def test_polygon_right_click_closes_the_path(app: Page):
    # A right-click closes the path from the last vertex already placed by a
    # left-click -- its own position isn't added as a vertex. Two non-collinear
    # left-clicks are needed so the closed path has nonzero width *and* height.
    index = MODES.index("polygon")
    target = canvas(app, index)
    click(app, target, 50, 50)
    click(app, target, 120, 100)
    click(app, target, 120, 100, button="right")
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Path"
    assert obj["width"] > 0
    assert obj["height"] > 0


def test_transform_moves_the_seeded_object(app: Page):
    index = MODES.index("transform")
    target = canvas(app, index)
    # Seeded rect is left=50,top=50,width=60,height=40 -> center (80, 70).
    drag(app, target, 80, 70, 110, 90, steps=10)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(80, abs=3)
    assert obj["top"] == pytest.approx(70, abs=3)
    assert obj["width"] == pytest.approx(60, abs=3)
    assert obj["height"] == pytest.approx(40, abs=3)
