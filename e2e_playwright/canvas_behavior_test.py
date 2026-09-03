"""E2E Playwright tests for st_canvas behaviours beyond drawing geometry."""

from __future__ import annotations

import pytest
from conftest import canvas, component, drag, read_json, wait_for_app_run
from playwright.sync_api import Page, expect


def test_update_streamlit_false_gates_sends_until_toolbar_forces_one(
    app: Page,
):
    target = canvas(app, 0)
    drag(app, target, 20, 20, 80, 80)
    # No rerun should happen -- give it a moment, then confirm nothing changed.
    app.wait_for_timeout(1500)
    assert read_json(app, 0)["objects"] == []

    component(app, 0).get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)
    assert len(read_json(app, 0)["objects"]) == 1


def test_right_click_no_longer_forces_a_send(app: Page):
    target = canvas(app, 0)
    drag(app, target, 20, 20, 80, 80)
    app.wait_for_timeout(1500)
    assert read_json(app, 0)["objects"] == []

    drag(app, target, 150, 150, 150, 150, button="right")
    app.wait_for_timeout(1500)
    assert read_json(app, 0)["objects"] == []


def test_initial_drawing_round_trips_into_another_canvas(app: Page):
    source = canvas(app, 1)
    drag(app, source, 30, 30, 100, 90)
    wait_for_app_run(app)

    # The component's returned *state* only updates on user interaction with
    # that canvas -- feeding a new `initial_drawing` prop from Python loads
    # it visually, but doesn't echo it back on its own. The toolbar's send
    # button exists for exactly this: force a report of what's now loaded.
    target_root = component(app, 2)
    target_root.get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)

    target_data = read_json(app, 1)
    assert len(target_data["objects"]) == 1
    obj = target_data["objects"][0]
    assert obj["type"] == "Rect"
    assert obj["left"] == pytest.approx(30, abs=3)
    assert obj["top"] == pytest.approx(30, abs=3)


def test_return_image_data_populates_ndarray_shape(app: Page):
    target = canvas(app, 3)
    drag(app, target, 20, 20, 100, 60)
    wait_for_app_run(app)

    expect(app.locator("text=/image_data shape:/")).to_be_visible(timeout=10000)
    expect(app.locator("text=/image_data: None/")).not_to_be_visible()


def test_canvas_inside_form_only_returns_drawing_on_submit(app: Page):
    target = canvas(app, 4)
    drag(app, target, 20, 20, 80, 80)
    # Drawing inside a form must not trigger an app rerun on its own.
    app.wait_for_timeout(1500)
    expect(app.locator("text=form submitted: False")).to_be_visible()
    assert read_json(app, 2) is None

    app.get_by_role("button", name="Submit").click()
    wait_for_app_run(app)
    expect(app.locator("text=form submitted: True")).to_be_visible()
    data = read_json(app, 2)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["type"] == "Rect"
