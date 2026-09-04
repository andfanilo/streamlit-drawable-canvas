"""E2E Playwright tests for edit mode's point editing (0.12.0 §3)."""

from __future__ import annotations

import math

import pytest
from conftest import canvas, click, drag, read_json, wait_for_app_run
from playwright.sync_api import Page


def scene_position(obj: dict, local_x: float, local_y: float) -> tuple[float, float]:
    """Fabric's Line serializes x1/y1/x2/y2 as calcLinePoints() output --
    already local, centred, pre-scale coordinates -- so this maps them
    straight to scene position (scale, then rotate, then translate)."""
    angle = math.radians(obj.get("angle", 0))
    sx, sy = obj.get("scaleX", 1), obj.get("scaleY", 1)
    lx, ly = local_x * sx, local_y * sy
    return (
        obj["left"] + lx * math.cos(angle) - ly * math.sin(angle),
        obj["top"] + lx * math.sin(angle) + ly * math.cos(angle),
    )


def force_send(app: Page, index: int) -> None:
    """Force a live serialization via the toolbar's send button -- json_data
    otherwise still echoes the literal Python-side seed until something is
    actually mutated and sent."""
    root = app.locator("[data-testid=stBidiComponentIsolated]").nth(index)
    root.get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)


SCENARIOS = [
    "polygon",
    "line",
    "rect",
    "circle",
    "circle_nonuniform",
    "locked_rect",
    "two_rects",
    "freedraw",
    "disabled_rect",
    "legacy_polygon",
    "polygon_realtime",
    "rect_undo",
    "polygon_reset",
    "line_rotated",
    "rect_and_circle",
]


def index_of(name: str) -> int:
    return SCENARIOS.index(name)


def descend(app: Page, target, x: float, y: float) -> None:
    """Select, then click again in place to enter point edit."""
    click(app, target, x, y)
    click(app, target, x, y)


def test_polygon_descend_and_drag_moves_only_that_vertex(app: Page):
    index = index_of("polygon")
    target = canvas(app, index)
    descend(app, target, 100, 90)  # polygon centre
    drag(app, target, 50, 50, 70, 70, steps=5)
    wait_for_app_run(app)

    data = read_json(app, index)
    obj = data["objects"][0]
    points = obj["points"]
    assert points[0]["x"] == pytest.approx(70, abs=5)
    assert points[0]["y"] == pytest.approx(70, abs=5)
    assert points[1]["x"] == pytest.approx(150, abs=5)
    assert points[1]["y"] == pytest.approx(50, abs=5)
    assert points[2]["x"] == pytest.approx(150, abs=5)
    assert points[2]["y"] == pytest.approx(130, abs=5)
    assert points[3]["x"] == pytest.approx(50, abs=5)
    assert points[3]["y"] == pytest.approx(130, abs=5)


def test_descend_requires_a_second_click_not_a_drag(app: Page):
    index = index_of("rect")
    target = canvas(app, index)
    click(app, target, 100, 90)  # select
    drag(app, target, 100, 90, 130, 110, steps=6)  # move -- must not descend
    wait_for_app_run(app)

    moved = read_json(app, index)["objects"][0]
    assert moved["type"] == "Rect"
    assert moved["left"] == pytest.approx(80, abs=5)
    assert moved["top"] == pytest.approx(70, abs=5)

    # If the slop test hadn't prevented descend, this corner drag would have
    # converted the rect to a polygon instead of scaling it.
    drag(app, target, 80, 70, 60, 50, steps=6)
    wait_for_app_run(app)
    scaled = read_json(app, index)["objects"][0]
    assert scaled["type"] == "Rect"


def test_polygon_anchor_click_removes_vertex_with_floor(app: Page):
    index = index_of("polygon")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    click(app, target, 150, 50)  # remove that vertex (index 1)
    wait_for_app_run(app)

    data = read_json(app, index)
    points = data["objects"][0]["points"]
    assert len(points) == 3

    # At the 3-vertex floor, clicking another anchor is a no-op.
    click(app, target, 150, 130)
    wait_for_app_run(app)
    points_after = read_json(app, index)["objects"][0]["points"]
    assert len(points_after) == 3


def test_line_endpoint_drag_leaves_other_endpoint_alone(app: Page):
    index = index_of("line")
    target = canvas(app, index)
    force_send(app, index)  # a live serialization, not the literal seed echo
    before = read_json(app, index)["objects"][0]
    other_scene_before = scene_position(before, before["x2"], before["y2"])

    descend(app, target, 100, 90)  # line centre; endpoint 1 at scene (50,50)
    drag(app, target, 50, 50, 70, 40, steps=5)
    wait_for_app_run(app)

    after = read_json(app, index)["objects"][0]
    moved_scene = scene_position(after, after["x1"], after["y1"])
    assert moved_scene[0] == pytest.approx(70, abs=3)
    assert moved_scene[1] == pytest.approx(40, abs=3)
    # Fabric's Line serializes x1/x2/y1/y2 as calcLinePoints() output, which
    # is recomputed from width/height on every change -- so the untouched
    # endpoint's *numbers* legitimately shift; its *rendered position* must
    # not.
    other_scene_after = scene_position(after, after["x2"], after["y2"])
    assert other_scene_after[0] == pytest.approx(other_scene_before[0], abs=3)
    assert other_scene_after[1] == pytest.approx(other_scene_before[1], abs=3)


def test_line_rotated_endpoint_drag_pins_other_endpoint_render_position(
    app: Page,
):
    index = index_of("line_rotated")
    target = canvas(app, index)
    force_send(app, index)
    before = read_json(app, index)["objects"][0]
    endpoint1_scene_before = scene_position(before, before["x1"], before["y1"])
    endpoint2_scene_before = scene_position(before, before["x2"], before["y2"])

    descend(app, target, 100, 90)
    drag(
        app,
        target,
        endpoint2_scene_before[0],
        endpoint2_scene_before[1],
        180,
        130,
        steps=6,
    )
    wait_for_app_run(app)

    after = read_json(app, index)["objects"][0]
    endpoint1_scene_after = scene_position(after, after["x1"], after["y1"])
    assert endpoint1_scene_after[0] == pytest.approx(endpoint1_scene_before[0], abs=2)
    assert endpoint1_scene_after[1] == pytest.approx(endpoint1_scene_before[1], abs=2)


def test_rect_corner_drag_converts_to_polygon(app: Page):
    index = index_of("rect")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    drag(app, target, 150, 130, 190, 170, steps=8)
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"] == "Polygon"
    assert len(obj["points"]) == 4
    assert obj["scaleX"] == pytest.approx(1)
    assert obj["scaleY"] == pytest.approx(1)
    assert obj["angle"] == pytest.approx(0, abs=1)


def test_rect_and_circle_zorder_survives_conversion(app: Page):
    index = index_of("rect_and_circle")
    target = canvas(app, index)
    descend(app, target, 50, 45)  # rect centre
    drag(app, target, 80, 70, 100, 90, steps=6)
    wait_for_app_run(app)

    objects = read_json(app, index)["objects"]
    assert objects[0]["type"] == "Polygon"
    assert objects[1]["type"] == "Circle"


def test_rect_descend_without_drag_stays_rect(app: Page):
    index = index_of("rect")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    click(app, target, 250, 190)  # click empty space -> exit
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"].lower() == "rect"


def test_circle_rim_drag_sets_radius(app: Page):
    index = index_of("circle")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    drag(app, target, 140, 90, 160, 90, steps=5)  # right rim
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["radius"] == pytest.approx(60, abs=5)
    assert obj["scaleX"] == pytest.approx(1)
    assert obj["scaleY"] == pytest.approx(1)
    assert obj["left"] == pytest.approx(100, abs=2)
    assert obj["top"] == pytest.approx(90, abs=2)


def test_circle_nonuniform_scale_does_not_descend(app: Page):
    index = index_of("circle_nonuniform")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    # Right-edge midpoint of the bbox (radius 40, scaleX 1, scaleY 1.5).
    drag(app, target, 140, 90, 160, 90, steps=5)
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    # A real descend would fold scale into radius and normalize scaleY to 1;
    # a level-1 default control resizes on one axis only.
    assert obj["scaleY"] == pytest.approx(1.5, abs=0.05)


def test_locked_object_does_not_descend(app: Page):
    index = index_of("locked_rect")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    drag(app, target, 150, 130, 190, 170, steps=8)
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"] == "Rect"


def test_multiselect_does_not_descend(app: Page):
    index = index_of("two_rects")
    target = canvas(app, index)
    click(app, target, 50, 45)  # select rect 1
    app.keyboard.down("Shift")
    click(app, target, 180, 125)  # add rect 2 -> ActiveSelection
    app.keyboard.up("Shift")
    click(app, target, 180, 125)  # second click on a member
    drag(app, target, 210, 100, 240, 80, steps=6)  # its corner
    wait_for_app_run(app)

    objects = read_json(app, index)["objects"]
    assert all(o["type"] == "Rect" for o in objects)


def test_freedraw_does_not_descend(app: Page):
    index = index_of("freedraw")
    target = canvas(app, index)
    descend(app, target, 90, 45)
    drag(app, target, 90, 45, 110, 60, steps=5)
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"] == "Path"


def test_disabled_canvas_does_not_descend(app: Page):
    index = index_of("disabled_rect")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    drag(app, target, 150, 130, 190, 170, steps=8)
    app.wait_for_timeout(300)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"].lower() == "rect"
    assert obj["left"] == pytest.approx(50, abs=1)


def test_legacy_polygon_converts_and_is_point_editable(app: Page):
    index = index_of("legacy_polygon")
    target = canvas(app, index)
    before = read_json(app, index)["objects"][0]
    assert before["type"] == "Polygon"  # converted on load, before any click
    before_point0 = before["points"][0]

    descend(app, target, 100, 90)
    drag(app, target, 50, 50, 70, 70, steps=5)
    wait_for_app_run(app)

    obj = read_json(app, index)["objects"][0]
    assert obj["type"] == "Polygon"
    points = obj["points"]
    # `points` is pathOffset-relative, not absolute -- assert the delta a
    # (50,50) -> (70,70) drag should produce, not an absolute target.
    assert points[0]["x"] == pytest.approx(before_point0["x"] + 20, abs=5)
    assert points[0]["y"] == pytest.approx(before_point0["y"] + 20, abs=5)


def test_point_edit_survives_a_rerun_with_update_streamlit(app: Page):
    index = index_of("polygon_realtime")
    target = canvas(app, index)
    descend(app, target, 100, 90)
    drag(app, target, 50, 50, 70, 70, steps=5)
    wait_for_app_run(app)

    drag(app, target, 150, 50, 170, 30, steps=5)
    wait_for_app_run(app)

    points = read_json(app, index)["objects"][0]["points"]
    assert points[0]["x"] == pytest.approx(70, abs=5)
    assert points[1]["x"] == pytest.approx(170, abs=5)
    assert points[1]["y"] == pytest.approx(30, abs=5)


def test_undo_after_rect_corner_drag_restores_rect_in_one_step(app: Page):
    index = index_of("rect_undo")
    target = canvas(app, index)
    root = app.locator("[data-testid=stBidiComponentIsolated]").nth(index)
    descend(app, target, 100, 90)
    drag(app, target, 150, 130, 190, 170, steps=8)
    wait_for_app_run(app)
    assert read_json(app, index)["objects"][0]["type"] == "Polygon"

    root.get_by_label("Undo").click()
    wait_for_app_run(app)
    obj = read_json(app, index)["objects"][0]
    assert obj["type"] == "Rect"


def test_reset_while_in_point_edit_exits_cleanly(app: Page):
    index = index_of("polygon_reset")
    target = canvas(app, index)
    root = app.locator("[data-testid=stBidiComponentIsolated]").nth(index)
    descend(app, target, 100, 90)
    drag(app, target, 50, 50, 70, 70, steps=5)
    wait_for_app_run(app)

    root.get_by_label("Reset").click()
    wait_for_app_run(app)
    data = read_json(app, index)
    points = data["objects"][0]["points"]
    assert points[0]["x"] == pytest.approx(50, abs=1)

    # A fresh descend + drag still works -- no orphaned controls/state.
    descend(app, target, 100, 90)
    drag(app, target, 150, 50, 170, 30, steps=5)
    wait_for_app_run(app)
    points_after = read_json(app, index)["objects"][0]["points"]
    assert points_after[1]["x"] == pytest.approx(170, abs=5)
