"""Streamlit app for E2E testing that two canvases don't interfere with each
other, and that a canvas's undo history survives an unrelated widget rerun
(the WeakMap instance model)."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("Canvas isolation E2E tests")

st.button("Trigger an unrelated rerun")

st.subheader("canvas A")
result_a = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    display_toolbar=True,
    key="iso_a",
)
st.code(json.dumps(result_a.json_data), language="json")

st.subheader("canvas B")
result_b = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    display_toolbar=True,
    key="iso_b",
)
st.code(json.dumps(result_b.json_data), language="json")
