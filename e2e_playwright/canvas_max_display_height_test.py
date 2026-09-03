"""E2E Playwright tests for `max_display_height`."""

from __future__ import annotations

import pytest
from conftest import component, read_json
from playwright.sync_api import Page


def test_capped_canvas_scrolls_within_max_display_height(app: Page):
    scroll_box = component(app, 0).locator(".dc-scroll").bounding_box()
    assert scroll_box is not None
    assert scroll_box["height"] == pytest.approx(200, abs=2)

    overflow_y = (
        component(app, 0)
        .locator(".dc-scroll")
        .evaluate("el => getComputedStyle(el).overflowY")
    )
    assert overflow_y == "auto"


def test_uncapped_canvas_is_not_scroll_limited(app: Page):
    scroll_box = component(app, 1).locator(".dc-scroll").bounding_box()
    assert scroll_box is not None
    assert scroll_box["height"] == pytest.approx(800, abs=2)


def test_canvas_dimensions_and_coordinates_are_unaffected(app: Page):
    for index in (0, 1):
        canvas_el = component(app, index).locator("canvas.upper-canvas")
        assert canvas_el.evaluate("el => el.width") == 300
        assert canvas_el.evaluate("el => el.height") == 800

        data = read_json(app, index)
        assert len(data["objects"]) == 1
        obj = data["objects"][0]
        assert obj["left"] == pytest.approx(50, abs=1)
        assert obj["top"] == pytest.approx(500, abs=1)
