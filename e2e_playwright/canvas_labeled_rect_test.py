"""E2E Playwright tests for the labeled-rect tool."""

from __future__ import annotations

import pytest
from conftest import (
    canvas,
    click,
    component,
    drag,
    enter_edit_mode,
    read_json,
    wait_for_app_run,
)
from playwright.sync_api import Page

(
    DRAW_BASIC,
    LABEL_SWITCH,
    EMPTY_LABEL,
    RELABEL,
    SCALE,
    NO_ROTATION,
    BG_STRETCH,
    BG_CONTAIN,
    BG_NONE,
    ROUNDTRIP,
) = range(10)


def test_draw_stamps_label_and_font_size(app: Page):
    target = canvas(app, DRAW_BASIC)
    drag(app, target, 20, 20, 150, 120)
    wait_for_app_run(app)

    data = read_json(app, DRAW_BASIC)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "LabeledRect"
    assert obj["label"] == "pedestrian"
    assert obj["fontSize"] == 30
    assert obj["lockRotation"] is True


def test_label_change_only_stamps_boxes_drawn_after_it(app: Page):
    target = canvas(app, LABEL_SWITCH)
    drag(app, target, 20, 20, 80, 70)
    wait_for_app_run(app)
    first = read_json(app, LABEL_SWITCH)
    assert first["objects"][0]["label"] == "cat"

    text_input = app.get_by_test_id("stTextInput").locator("input")
    text_input.fill("dog")
    text_input.press("Enter")
    wait_for_app_run(app)

    drag(app, target, 150, 20, 220, 70)
    wait_for_app_run(app)
    data = read_json(app, LABEL_SWITCH)
    assert len(data["objects"]) == 2
    assert data["objects"][0]["label"] == "cat"  # unchanged by the later switch
    assert data["objects"][1]["label"] == "dog"


def test_empty_label_draws_a_labelless_box(app: Page):
    target = canvas(app, EMPTY_LABEL)
    drag(app, target, 20, 20, 100, 90)
    wait_for_app_run(app)

    data = read_json(app, EMPTY_LABEL)
    assert data["objects"][0]["label"] == ""


def test_relabel_updates_json_data(app: Page):
    index = RELABEL
    target = canvas(app, index)

    enter_edit_mode(app, index)
    click(app, target, 100, 80)  # select
    click(app, target, 100, 80)  # already selected -> opens the relabel IText
    app.keyboard.type("new")
    enter_edit_mode(app, index)  # toggle off -> forces the commit
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["label"] == "new"
    assert data["objects"][0]["type"] == "LabeledRect"


def test_relabel_is_one_undo_entry(app: Page):
    index = RELABEL
    target = canvas(app, index)
    root = component(app, index)

    enter_edit_mode(app, index)
    click(app, target, 100, 80)
    click(app, target, 100, 80)
    app.keyboard.type("new")
    enter_edit_mode(app, index)
    wait_for_app_run(app)
    assert read_json(app, index)["objects"][0]["label"] == "new"

    root.hover()
    root.get_by_label("Undo").click()
    wait_for_app_run(app)
    assert read_json(app, index)["objects"][0]["label"] == "old"


def test_transient_itext_never_reaches_json_data(app: Page):
    index = RELABEL
    target = canvas(app, index)
    root = component(app, index)

    enter_edit_mode(app, index)
    click(app, target, 100, 80)
    click(app, target, 100, 80)  # relabel IText is up, pre-filled "old"

    # Force a snapshot mid-edit -- the scratch IText must not leak in.
    root.hover()
    root.get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["type"] == "LabeledRect"
    assert data["objects"][0]["label"] == "old"


def test_scaling_preserves_label_and_does_not_convert_to_polygon(app: Page):
    index = SCALE
    target = canvas(app, index)

    enter_edit_mode(app, index)
    click(app, target, 100, 80)  # select (RELABEL_SEED box: 50,50 -> 150,110)
    drag(app, target, 150, 110, 220, 160)  # drag the br corner: whole-object scale
    wait_for_app_run(app)

    data = read_json(app, index)
    obj = data["objects"][0]
    assert obj["type"] == "LabeledRect"  # not converted, unlike point-edited Rect
    assert obj["label"] == "old"
    assert obj["scaleX"] > 1.1
    assert obj["scaleY"] > 1.1


def test_no_rotation_handle(app: Page):
    index = NO_ROTATION
    target = canvas(app, index)

    enter_edit_mode(app, index)
    click(app, target, 100, 80)  # select
    # Where the (hidden) rotation handle would sit, well above the box.
    drag(app, target, 100, 10, 160, 10)
    wait_for_app_run(app)

    data = read_json(app, index)
    obj = data["objects"][0]
    assert obj["angle"] == 0
    assert obj["type"] == "LabeledRect"


def test_background_fit_stretch(app: Page):
    app.wait_for_timeout(1000)  # background image load is async
    fit = read_json(app, BG_STRETCH)
    assert fit["natural_width"] == 2000
    assert fit["natural_height"] == 1000
    assert fit["scale_x"] == pytest.approx(0.3)
    assert fit["scale_y"] == pytest.approx(0.4)
    assert fit["offset_x"] == 0
    assert fit["offset_y"] == 0


def test_background_fit_contain(app: Page):
    app.wait_for_timeout(1000)
    fit = read_json(app, BG_CONTAIN)
    assert fit["scale_x"] == pytest.approx(0.3)
    assert fit["scale_y"] == pytest.approx(0.3)
    assert fit["offset_x"] == pytest.approx(0)
    assert fit["offset_y"] == pytest.approx(50)


def test_background_fit_none_without_a_background_image(app: Page):
    assert read_json(app, BG_NONE) is None


def test_boxes_round_trip_through_initial_drawing(app: Page):
    boxes = read_json(app, ROUNDTRIP)
    assert boxes == [
        {"label": "roundtrip", "left": 15, "top": 25, "width": 90, "height": 45}
    ]
