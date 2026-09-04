"""Streamlit app for E2E testing of each st_canvas drawing_mode."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.set_page_config(layout="wide")
st.title("Canvas drawing-mode E2E tests")

MODES = ["freedraw", "line", "rect", "circle", "point", "polygon", "text"]

for mode in MODES:
    st.subheader(f"mode: {mode}")
    result = st_canvas(
        fill_color="#ffffff",
        stroke_width=1,
        stroke_color="#000000",
        height=200,
        width=300,
        drawing_mode=mode,
        key=f"mode_{mode}",
    )
    st.code(json.dumps(result.json_data), language="json")
