"""E2E Playwright tests for the toolbar's edit toggle (0.12.0 §4.6)."""

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
from playwright.sync_api import Page, expect


def _toolbar_opacity(app: Page, index: int) -> float:
    return float(
        component(app, index)
        .locator(".dc-toolbar")
        .evaluate("el => getComputedStyle(el).opacity")
    )


def test_toggle_off_returns_to_the_named_drawing_tool(app: Page):
    index = 0
    target = canvas(app, index)

    enter_edit_mode(app, index)
    enter_edit_mode(app, index)  # toggle off
    drag(app, target, 20, 20, 80, 70)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["type"] == "Rect"


def test_changing_drawing_mode_resets_the_toggle(app: Page):
    index = 0
    edit_button = component(app, index).get_by_label("Edit")

    enter_edit_mode(app, index)
    expect(edit_button).to_have_attribute("aria-pressed", "true")

    app.get_by_test_id("stRadio").get_by_text("line", exact=True).click()
    wait_for_app_run(app)
    expect(edit_button).to_have_attribute("aria-pressed", "false")

    target = canvas(app, index)
    drag(app, target, 20, 20, 80, 70)
    wait_for_app_run(app)
    data = read_json(app, index)
    assert data["objects"][-1]["type"] == "Line"


def test_unrelated_widget_rerun_does_not_reset_the_toggle(app: Page):
    index = 0
    edit_button = component(app, index).get_by_label("Edit")

    enter_edit_mode(app, index)
    expect(edit_button).to_have_attribute("aria-pressed", "true")

    app.get_by_role("slider").click(force=True)
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)

    expect(edit_button).to_have_attribute("aria-pressed", "true")


def test_contextual_buttons_absent_until_toggle_on(app: Page):
    index = 0
    root = component(app, index)

    expect(root.get_by_label("Delete selected")).to_be_hidden()
    enter_edit_mode(app, index)
    expect(root.get_by_label("Delete selected")).to_be_visible()


def test_toolbar_stays_visible_without_hover_while_edit_is_on(app: Page):
    index = 0
    root = component(app, index)
    root.scroll_into_view_if_needed()

    assert root.locator(".dc-toolbar").get_attribute("data-pinned") == "false"

    enter_edit_mode(app, index)
    app.mouse.move(0, 0)  # move away from the canvas -- no hover left behind
    assert root.locator(".dc-toolbar").get_attribute("data-pinned") == "true"
    # The reveal transition is 150ms with a 100ms delay.
    app.wait_for_timeout(500)
    assert _toolbar_opacity(app, index) == 1


def test_toggle_survives_a_rerun_with_update_streamlit(app: Page):
    index = 1
    target = canvas(app, index)
    edit_button = component(app, index).get_by_label("Edit")

    enter_edit_mode(app, index)
    before = read_json(app, index)
    assert before["objects"][0]["left"] == pytest.approx(20, abs=3)
    assert before["objects"][1]["left"] == pytest.approx(150, abs=3)

    drag(app, target, 50, 45, 70, 65)  # move the first rect
    wait_for_app_run(app)
    after_first = read_json(app, index)
    assert after_first["objects"][0]["left"] == pytest.approx(40, abs=5)
    expect(edit_button).to_have_attribute("aria-pressed", "true")

    drag(app, target, 180, 125, 200, 145)  # move the second rect, no re-toggle
    wait_for_app_run(app)
    after_second = read_json(app, index)
    assert after_second["objects"][1]["left"] == pytest.approx(170, abs=5)


def test_toggle_on_mid_polygon_discards_the_in_progress_shape(app: Page):
    index = 2
    target = canvas(app, index)

    click(app, target, 20, 20)
    click(app, target, 80, 20)
    click(app, target, 80, 80)

    enter_edit_mode(app, index)
    enter_edit_mode(app, index)  # toggle off, back to the polygon tool

    # If the in-progress shape had survived, it would still be on canvas
    # and this fresh polygon would close alongside a stray leftover object.
    click(app, target, 20, 20)
    click(app, target, 150, 20)
    click(app, target, 150, 100)
    click(app, target, 20, 20)  # first vertex's handle again -> closes
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    assert data["objects"][0]["type"] == "Polygon"


def test_toggle_on_while_typing_commits_text_exactly_once(app: Page):
    index = 3
    target = canvas(app, index)
    root = component(app, index)

    click(app, target, 30, 30)
    app.keyboard.type("Hi")
    enter_edit_mode(app, index)
    wait_for_app_run(app)

    data = read_json(app, index)
    assert len(data["objects"]) == 1
    obj = data["objects"][0]
    assert obj["type"] == "IText"
    assert obj["text"] == "Hi"

    # One undo removes the whole object -- if toggling had written its own
    # history entry on top of the text commit, this would take two.
    root.get_by_label("Undo").click()
    wait_for_app_run(app)
    assert read_json(app, index)["objects"] == []


def test_toggling_writes_no_history_entry(app: Page):
    index = 4
    target = canvas(app, index)
    root = component(app, index)

    drag(app, target, 30, 30, 100, 80, steps=10)
    wait_for_app_run(app)
    assert len(read_json(app, index)["objects"]) == 1

    enter_edit_mode(app, index)
    enter_edit_mode(app, index)  # toggle off

    root.get_by_label("Undo").click()
    wait_for_app_run(app)
    assert read_json(app, index)["objects"] == []


def test_disabled_canvas_has_no_toolbar(app: Page):
    index = 5
    root = component(app, index)
    expect(root.locator(".dc-toolbar")).to_be_hidden()
