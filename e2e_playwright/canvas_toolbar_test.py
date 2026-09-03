"""E2E Playwright tests for the undo/redo/reset toolbar."""

from __future__ import annotations

from conftest import canvas, component, drag, read_json, wait_for_app_run
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
