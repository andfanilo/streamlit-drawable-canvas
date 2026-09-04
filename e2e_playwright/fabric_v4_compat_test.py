"""E2E Playwright tests verifying each committed Fabric 4 JSON fixture still
loads under Fabric 7."""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from conftest import component, read_json, wait_for_app_run
from PIL import Image
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

# 0.12.0 §3.4.2: a closed M/L `path` polygon converts to a `Polygon` on load,
# so its serialized type no longer matches the v4 fixture's literal `type`.
_EXPECTED_TYPE_OVERRIDE = {"polygon": "polygon"}


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
        expected = _EXPECTED_TYPE_OVERRIDE.get(name, fixture_obj["type"])
        assert loaded_obj["type"].lower() == expected


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


def test_polygon_fixture_converts_to_polygon_with_points(app: Page):
    index = FIXTURE_NAMES.index("polygon")
    loaded = _send_and_read(app, index)

    assert len(loaded["objects"]) == 1
    obj = loaded["objects"][0]
    assert obj["type"] == "Polygon"
    points = obj["points"]
    assert len(points) == 4
    # `points` is stored relative to the polygon's own pathOffset (its bbox
    # centre), not as the v4 path's original absolute coordinates -- position
    # correctness is `setPositionByOrigin`'s job (proven by the render-
    # equality test below) and reflected in left/top/width/height instead.
    xs = [p["x"] for p in points]
    ys = [p["y"] for p in points]
    assert max(xs) - min(xs) == pytest.approx(200, abs=1)
    assert max(ys) - min(ys) == pytest.approx(140, abs=1)
    assert obj["width"] == pytest.approx(200, abs=1)
    assert obj["height"] == pytest.approx(140, abs=1)
    assert obj["angle"] == pytest.approx(0, abs=1)


def test_polygon_fixture_renders_identically_to_native_polygon(app: Page):
    # The v4 fixture (a closed M/L `path`) and `polygon-native-comparison`
    # (a hand-authored native `Polygon`) describe the same points, fill and
    # stroke. Diffing their rendered pixels proves the load-time conversion
    # doesn't change what the user sees (0.12.0 §3.4.2/§3.9), without a
    # stored screenshot baseline (T4's actual claim here is pixel parity
    # between the two live renders, not a snapshot regression).
    converted_index = FIXTURE_NAMES.index("polygon")
    native_index = len(FIXTURE_NAMES)  # polygon-native-comparison, appended last

    converted_png = (
        component(app, converted_index).locator(".dc-container").screenshot()
    )
    native_png = component(app, native_index).locator(".dc-container").screenshot()

    converted_img = Image.open(BytesIO(converted_png)).convert("RGB")
    native_img = Image.open(BytesIO(native_png)).convert("RGB")
    assert converted_img.size == native_img.size

    diff = np.abs(
        np.asarray(converted_img, dtype=np.int16)
        - np.asarray(native_img, dtype=np.int16)
    )
    # Same browser, same run, same rasterizer, identical geometry -- allow a
    # tiny per-pixel tolerance for floating-point/AA noise, not a real
    # mismatch.
    assert diff.max() <= 2, f"max per-channel pixel diff was {diff.max()}"
