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
        drawing_mode="transform",
        initial_drawing=fixture_data,
        key=f"fixture_{name}",
    )
    st.code(json.dumps(result.json_data), language="json")
