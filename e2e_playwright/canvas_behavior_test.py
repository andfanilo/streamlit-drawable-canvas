"""E2E Playwright tests for st_canvas behaviours beyond drawing geometry."""

from __future__ import annotations

import json

import pytest
from conftest import wait_for_app_run
from playwright.sync_api import Page, expect


def _canvas(app: Page, index: int):
    c = (
        app.locator("[data-testid=stBidiComponentIsolated]")
        .nth(index)
        .locator("canvas.upper-canvas")
    )
    c.scroll_into_view_if_needed()
    return c


def _code(app: Page, index: int):
    text = app.locator("[data-testid=stCode]").nth(index).inner_text()
    return json.loads(text)


def _drag(app: Page, canvas, x0, y0, x1, y1, button="left"):
    box = canvas.bounding_box()
    assert box is not None
    app.mouse.move(box["x"] + x0, box["y"] + y0)
    app.mouse.down(button=button)
    app.mouse.move(box["x"] + x1, box["y"] + y1)
    app.mouse.up(button=button)


def test_update_streamlit_false_gates_sends_until_right_click_forces_one(
    app: Page,
):
    canvas = _canvas(app, 0)
    _drag(app, canvas, 20, 20, 80, 80)
    # No rerun should happen -- give it a moment, then confirm nothing changed.
    app.wait_for_timeout(1500)
    assert _code(app, 0)["objects"] == []

    _drag(app, canvas, 150, 150, 150, 150, button="right")
    wait_for_app_run(app)
    assert len(_code(app, 0)["objects"]) == 1


def test_initial_drawing_round_trips_into_another_canvas(app: Page):
    source = _canvas(app, 1)
    _drag(app, source, 30, 30, 100, 90)
    wait_for_app_run(app)

    # The component's returned *state* only updates on user interaction with
    # that canvas -- feeding a new `initial_drawing` prop from Python loads
    # it visually, but doesn't echo it back on its own. The toolbar's send
    # button exists for exactly this: force a report of what's now loaded.
    target_root = app.locator("[data-testid=stBidiComponentIsolated]").nth(2)
    target_root.get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)

    target_data = _code(app, 1)
    assert len(target_data["objects"]) == 1
    obj = target_data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(30, abs=3)
    assert obj["top"] == pytest.approx(30, abs=3)


def test_return_image_data_populates_ndarray_shape(app: Page):
    canvas = _canvas(app, 3)
    _drag(app, canvas, 20, 20, 100, 60)
    wait_for_app_run(app)

    expect(app.locator("text=/image_data shape:/")).to_be_visible(timeout=10000)
    expect(app.locator("text=/image_data: None/")).not_to_be_visible()


def test_canvas_inside_form_only_returns_drawing_on_submit(app: Page):
    canvas = _canvas(app, 4)
    _drag(app, canvas, 20, 20, 80, 80)
    # Drawing inside a form must not trigger an app rerun on its own.
    app.wait_for_timeout(1500)
    expect(app.locator("text=form submitted: False")).to_be_visible()
    assert _code(app, 2) is None

    app.get_by_role("button", name="Submit").click()
    wait_for_app_run(app)
    expect(app.locator("text=form submitted: True")).to_be_visible()
    data = _code(app, 2)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["type"] == "Rect"
