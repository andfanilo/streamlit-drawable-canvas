"""E2E Playwright tests verifying each committed Fabric 4 JSON fixture still
loads under Fabric 7."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import component, read_json, wait_for_app_run
from playwright.sync_api import Page

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "fabric-v4"
FIXTURE_NAMES = [
    "freedraw",
    "line",
    "rect",
    "circle",
    "point",
    "polygon",
    "transform",
    "kitchen-sink",
]


def _send_and_read(app: Page, index: int) -> dict:
    # A loaded `initial_drawing` isn't echoed back as widget state on its
    # own -- the toolbar's send button re-serializes the live canvas.
    component(app, index).get_by_label("Update the app with this drawing").click()
    wait_for_app_run(app)
    return read_json(app, index)


@pytest.mark.parametrize("name", FIXTURE_NAMES)
def test_v4_fixture_loads_under_fabric_7(app: Page, name: str):
    index = FIXTURE_NAMES.index(name)
    fixture = json.loads((FIXTURES_DIR / f"{name}.json").read_text())
    loaded = _send_and_read(app, index)

    assert len(loaded["objects"]) == len(fixture["objects"])
    for loaded_obj, fixture_obj in zip(loaded["objects"], fixture["objects"]):
        # Fabric 7 capitalizes type names (v4 used lowercase); object
        # identity/count is what this test cares about, not full geometry.
        assert loaded_obj["type"].lower() == fixture_obj["type"]


def test_circle_and_point_load_but_geometry_is_declared_breaking(app: Page):
    # R3 finding: Circle.startAngle/endAngle changed from radians (v4) to
    # degrees (v7). Pre-0.10.0 Circle/Point objects still *load* under
    # Fabric 7 (asserted here) but render incorrectly -- declared a breaking
    # change (maintainer decision), not shimmed. See CHANGELOG.md (stage 3).
    for name in ("circle", "point"):
        index = FIXTURE_NAMES.index(name)
        loaded = _send_and_read(app, index)
        assert len(loaded["objects"]) == 1
        # Re-serialized by Fabric 7, so the type comes back capitalized.
        assert loaded["objects"][0]["type"] == "Circle"
