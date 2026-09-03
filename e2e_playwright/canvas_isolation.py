"""Streamlit app for E2E testing that two canvases don't interfere with each
other, that a canvas's undo history survives an unrelated widget rerun (the
WeakMap instance model), and that creating a canvas leaves st.session_state
alone (issue #141)."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("Canvas isolation E2E tests")

# #141 reported st.session_state being cleared by a canvas with height < 300.
# Both canvases below are height=200, so merely reading this back after they
# are created is the regression check.
if "foo" not in st.session_state:
    st.session_state["foo"] = "value"

st.button("Trigger an unrelated rerun")

st.subheader("canvas A")
result_a = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    key="iso_a",
)
st.code(json.dumps(result_a.json_data), language="json")

st.subheader("canvas B")
result_b = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    key="iso_b",
)
st.code(json.dumps(result_b.json_data), language="json")

# Read after both canvases are created -- a cleared session_state raises
# KeyError here rather than reaching the assertion.
st.code(json.dumps({"foo": st.session_state["foo"]}), language="json")
