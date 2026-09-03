"""E2E Playwright tests for cross-canvas isolation, undo-history persistence
across an unrelated rerun (the WeakMap instance model), and session_state
surviving canvas creation (issue #141)."""

from __future__ import annotations

import json

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
    return json.loads(app.locator("[data-testid=stCode]").nth(index).inner_text())


def _drag(app: Page, canvas, x0, y0, x1, y1):
    box = canvas.bounding_box()
    assert box is not None
    app.mouse.move(box["x"] + x0, box["y"] + y0)
    app.mouse.down()
    app.mouse.move(box["x"] + x1, box["y"] + y1)
    app.mouse.up()
    wait_for_app_run(app)


def test_two_canvases_do_not_interfere(app: Page):
    canvas_a = _canvas(app, 0)
    _drag(app, canvas_a, 20, 20, 80, 80)

    assert len(_code(app, 0)["objects"]) == 1
    assert _code(app, 1)["objects"] == []


def test_undo_history_survives_an_unrelated_rerun(app: Page):
    canvas_a = _canvas(app, 0)
    _drag(app, canvas_a, 20, 20, 80, 80)
    _drag(app, canvas_a, 100, 100, 150, 150)
    assert len(_code(app, 0)["objects"]) == 2

    app.get_by_role("button", name="Trigger an unrelated rerun").click()
    wait_for_app_run(app)

    # The drawing itself, and undo's ability to reach the first object, must
    # both survive a rerun that had nothing to do with this canvas.
    assert len(_code(app, 0)["objects"]) == 2
    root_a = app.locator("[data-testid=stBidiComponentIsolated]").nth(0)
    undo_button = root_a.get_by_label("Undo")
    expect(undo_button).to_be_enabled()

    undo_button.click()
    wait_for_app_run(app)
    assert len(_code(app, 0)["objects"]) == 1


def test_session_state_survives_canvas_creation(app: Page):
    # #141: creating a canvas with height < 300 was reported to clear
    # st.session_state. Both canvases here are height=200; the app reads the
    # key back after creating them, so a cleared state surfaces as a KeyError
    # in the app rather than a wrong value here.
    assert _code(app, 2)["foo"] == "value"

    app.get_by_role("button", name="Trigger an unrelated rerun").click()
    wait_for_app_run(app)

    assert _code(app, 2)["foo"] == "value"
