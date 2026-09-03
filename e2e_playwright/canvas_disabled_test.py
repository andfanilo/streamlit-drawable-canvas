"""E2E Playwright tests for `disabled=True` (issue #140)."""

from __future__ import annotations

from conftest import canvas, component, drag, read_json, wait_for_app_run
from playwright.sync_api import Page, expect

DISABLED, ENABLED = 0, 1


def test_enabled_control_still_draws(app: Page):
    # Guards the two tests below: if this drag stopped working, their
    # "nothing happened" assertions would pass for the wrong reason.
    target = canvas(app, ENABLED)
    drag(app, target, 150, 120, 250, 170)
    wait_for_app_run(app)

    assert len(read_json(app, ENABLED)["objects"]) == 2


def test_disabled_canvas_ignores_drawing(app: Page):
    before = read_json(app, DISABLED)
    assert len(before["objects"]) == 1  # the seed renders

    target = canvas(app, DISABLED)
    drag(app, target, 150, 120, 250, 170)
    app.wait_for_timeout(500)  # no rerun is expected, so don't wait for one

    assert read_json(app, DISABLED) == before


def test_disabled_canvas_ignores_transform(app: Page):
    # The seeded rect spans (50,50)-(110,90); centre is (80, 70). On an
    # enabled transform canvas this drag would move it.
    before = read_json(app, DISABLED)

    target = canvas(app, DISABLED)
    drag(app, target, 80, 70, 140, 120)
    app.wait_for_timeout(500)

    assert read_json(app, DISABLED) == before


def test_disabled_hides_the_toolbar(app: Page):
    disabled_root = component(app, DISABLED)
    enabled_root = component(app, ENABLED)

    expect(disabled_root.get_by_label("Reset canvas & history")).to_be_hidden()
    expect(enabled_root.get_by_label("Reset canvas & history")).to_be_visible()
