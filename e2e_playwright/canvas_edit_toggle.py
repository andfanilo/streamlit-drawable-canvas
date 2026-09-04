"""Streamlit app for E2E testing of the toolbar's edit toggle (0.12.0 §4)."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.set_page_config(layout="wide")
st.title("Edit toggle E2E tests")

st.subheader("toggle basics")
mode = st.radio("mode", ["rect", "line"], key="toggle_mode")
result_basic = st_canvas(
    fill_color="#ffffff",
    stroke_width=2,
    stroke_color="#000000",
    height=200,
    width=300,
    drawing_mode=mode,
    key="toggle_basic",
)
st.code(json.dumps(result_basic.json_data), language="json")

st.subheader("unrelated widget")
st.slider("unrelated slider", 0, 10, 0, key="unrelated_slider")

TWO_RECTS_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 20,
            "top": 20,
            "width": 60,
            "height": 50,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        },
        {
            "type": "rect",
            "left": 150,
            "top": 100,
            "width": 60,
            "height": 50,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        },
    ]
}

st.subheader("rerun survival")
result_rerun = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=TWO_RECTS_SEED,
    key="toggle_rerun",
)
st.code(json.dumps(result_rerun.json_data), language="json")

st.subheader("polygon mid-draw")
result_polygon = st_canvas(
    height=200,
    width=300,
    drawing_mode="polygon",
    key="toggle_polygon",
)
st.code(json.dumps(result_polygon.json_data), language="json")

st.subheader("text mid-edit")
result_text = st_canvas(
    height=200,
    width=300,
    drawing_mode="text",
    key="toggle_text",
)
st.code(json.dumps(result_text.json_data), language="json")

st.subheader("history")
result_history = st_canvas(
    height=200,
    width=300,
    drawing_mode="freedraw",
    key="toggle_history",
)
st.code(json.dumps(result_history.json_data), language="json")

st.subheader("disabled canvas")
result_disabled = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    disabled=True,
    key="toggle_disabled",
)
st.code(json.dumps(result_disabled.json_data), language="json")
