"""E2E Playwright tests for the undo/redo/reset toolbar."""

from __future__ import annotations

import json

from conftest import wait_for_app_run
from playwright.sync_api import Page, expect


def _canvas(app: Page):
    return app.locator("[data-testid=stBidiComponentIsolated]").first.locator(
        "canvas.upper-canvas"
    )


def _code(app: Page) -> dict:
    text = app.locator("[data-testid=stCode]").first.inner_text()
    return json.loads(text)


def _draw_rect(app: Page, x0, y0, x1, y1):
    canvas = _canvas(app)
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    assert box is not None
    app.mouse.move(box["x"] + x0, box["y"] + y0)
    app.mouse.down()
    app.mouse.move(box["x"] + x1, box["y"] + y1)
    app.mouse.up()
    wait_for_app_run(app)


def test_undo_redo_and_reset(app: Page):
    root = app.locator("[data-testid=stBidiComponentIsolated]").first
    undo_button = root.get_by_label("Undo")
    redo_button = root.get_by_label("Redo")

    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_disabled()

    _draw_rect(app, 20, 20, 60, 60)
    _draw_rect(app, 100, 100, 150, 150)
    assert len(_code(app)["objects"]) == 2
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_disabled()

    undo_button.click()
    wait_for_app_run(app)
    assert len(_code(app)["objects"]) == 1
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_enabled()

    undo_button.click()
    wait_for_app_run(app)
    assert len(_code(app)["objects"]) == 0
    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_enabled()

    redo_button.click()
    wait_for_app_run(app)
    assert len(_code(app)["objects"]) == 1
    expect(undo_button).to_be_enabled()
    expect(redo_button).to_be_enabled()

    redo_button.click()
    wait_for_app_run(app)
    assert len(_code(app)["objects"]) == 2
    expect(redo_button).to_be_disabled()

    root.get_by_label("Reset canvas & history").click()
    wait_for_app_run(app)
    assert len(_code(app)["objects"]) == 0
    expect(undo_button).to_be_disabled()
    expect(redo_button).to_be_disabled()
