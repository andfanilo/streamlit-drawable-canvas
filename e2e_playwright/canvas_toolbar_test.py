"""E2E Playwright tests for the undo/redo/reset toolbar."""

from __future__ import annotations

import pytest
from conftest import canvas, click, component, drag, read_json, wait_for_app_run
from playwright.sync_api import Page, expect


def _draw_rect(app: Page, x0, y0, x1, y1):
    drag(app, canvas(app), x0, y0, x1, y1)
    wait_for_app_run(app)


def test_undo_redo_and_reset(app: Page):
    root = component(app)
    undo_button = root.get_by_label("Undo")
    redo_button = root.get_by_label("Redo")

    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_disabled()

    _draw_rect(app, 20, 20, 60, 60)
    _draw_rect(app, 100, 100, 150, 150)
    assert len(read_json(app)["objects"]) == 2
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_disabled()

    undo_button.click()
    wait_for_app_run(app)
    assert len(read_json(app)["objects"]) == 1
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_enabled()

    undo_button.click()
    wait_for_app_run(app)
    assert len(read_json(app)["objects"]) == 0
    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_enabled()

    redo_button.click()
    wait_for_app_run(app)
    assert len(read_json(app)["objects"]) == 1
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_enabled()

    redo_button.click()
    wait_for_app_run(app)
    assert len(read_json(app)["objects"]) == 2
    expect(redo_button).to_be_disabled()

    root.get_by_label("Reset canvas & history").click()
    wait_for_app_run(app)
    assert len(read_json(app)["objects"]) == 0
    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_disabled()


def _toolbar_opacity(app: Page, index: int) -> float:
    return float(
        component(app, index)
        .locator(".dc-toolbar")
        .evaluate("el => getComputedStyle(el).opacity")
    )


def test_toolbar_is_hover_revealed_when_updates_are_realtime(app: Page):
    root = component(app)
    root.scroll_into_view_if_needed()

    assert root.locator(".dc-toolbar").get_attribute("data-pinned") == "false"
    assert _toolbar_opacity(app, 0) == 0

    canvas(app).hover()
    expect(root.get_by_label("Undo")).to_be_visible()
    # The reveal transition is 150ms with a 100ms delay.
    app.wait_for_timeout(500)
    assert _toolbar_opacity(app, 0) == 1


def test_toolbar_is_pinned_when_update_streamlit_is_false(app: Page):
    root = component(app, 1)
    root.scroll_into_view_if_needed()

    # Never hovered: the send button is the only way to commit a drawing
    # here, so it must not be hidden behind a hover.
    assert root.locator(".dc-toolbar").get_attribute("data-pinned") == "true"
    assert _toolbar_opacity(app, 1) == 1
    expect(root.get_by_label("Update the app with this drawing")).to_be_visible()


def test_contextual_buttons_shown_only_in_transform_mode(app: Page):
    rect_root = component(app, 0)
    transform_root = component(app, 2)

    expect(rect_root.get_by_label("Bring forward")).to_be_hidden()
    expect(rect_root.get_by_label("Send backward")).to_be_hidden()
    expect(rect_root.get_by_label("Delete selected")).to_be_hidden()

    expect(transform_root.get_by_label("Bring forward")).to_be_visible()
    expect(transform_root.get_by_label("Send backward")).to_be_visible()
    expect(transform_root.get_by_label("Delete selected")).to_be_visible()


def test_delete_selected_removes_only_the_active_object(app: Page):
    target = canvas(app, 2)
    transform_root = component(app, 2)
    assert len(read_json(app, 1)["objects"]) == 2

    click(app, target, 25, 25)
    transform_root.get_by_label("Delete selected").click()
    wait_for_app_run(app)

    after = read_json(app, 1)
    assert len(after["objects"]) == 1
    assert after["objects"][0]["left"] == pytest.approx(40, abs=3)


def test_bring_forward_reorders_objects(app: Page):
    target = canvas(app, 2)
    transform_root = component(app, 2)
    before = read_json(app, 1)
    assert before["objects"][0]["left"] == pytest.approx(20, abs=3)

    click(app, target, 25, 25)
    transform_root.get_by_label("Bring forward").click()
    wait_for_app_run(app)

    after = read_json(app, 1)
    assert after["objects"][1]["left"] == pytest.approx(20, abs=3)


def test_double_click_in_transform_mode_no_longer_deletes(app: Page):
    target = canvas(app, 2)
    target.scroll_into_view_if_needed()
    box = target.bounding_box()
    assert box is not None
    assert len(read_json(app, 1)["objects"]) == 2

    app.mouse.dblclick(box["x"] + 90, box["y"] + 90)
    app.wait_for_timeout(500)

    assert len(read_json(app, 1)["objects"]) == 2
