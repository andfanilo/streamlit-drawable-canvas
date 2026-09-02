"""Streamlit app for E2E testing of the undo/redo/reset toolbar."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("Canvas toolbar E2E tests")

result = st_canvas(
    fill_color="#ffffff",
    stroke_width=1,
    stroke_color="#000000",
    height=200,
    width=300,
    drawing_mode="rect",
    display_toolbar=True,
    key="toolbar",
)
st.code(json.dumps(result.json_data), language="json")
