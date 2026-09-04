"""Streamlit app for E2E testing that each committed Fabric 4 JSON fixture
still loads under Fabric 7 (T5, risk R3)."""

import json
from pathlib import Path

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.set_page_config(layout="wide")
st.title("Fabric v4 fixture compatibility")

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

for name in FIXTURE_NAMES:
    st.subheader(name)
    fixture_data = json.loads((FIXTURES_DIR / f"{name}.json").read_text())
    result = st_canvas(
        height=200,
        width=300,
        drawing_mode="rect",
        initial_drawing=fixture_data,
        key=f"fixture_{name}",
    )
    st.code(json.dumps(result.json_data), language="json")

# 0.12.0 §3.4.2/§3.9: a v4 closed M/L `path` polygon (see polygon.json) converts
# to a `Polygon` on load. This canvas is hand-authored with the *same* points,
# fill and stroke as a native v7 Polygon, so a test can diff its render
# against the converted fixture and prove the conversion doesn't change what
# the user sees.
st.subheader("polygon-native-comparison")
native_polygon_data = {
    "version": "7.4.0",
    "objects": [
        {
            "type": "polygon",
            "points": [
                {"x": 49, "y": 29},
                {"x": 249, "y": 29},
                {"x": 249, "y": 169},
                {"x": 49, "y": 169},
            ],
            "fill": "rgba(255, 140, 0, 0.3)",
            "stroke": "#ff8c00",
            "strokeWidth": 3,
            "strokeUniform": False,
        }
    ],
    "background": "#eeeeee",
}
native_result = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=native_polygon_data,
    key="fixture_polygon_native",
)
st.code(json.dumps(native_result.json_data), language="json")
