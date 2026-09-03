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
    key="toolbar",
)
st.code(json.dumps(result.json_data), language="json")

st.subheader("update_streamlit=False pins the toolbar")
st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    update_streamlit=False,
    key="toolbar_pinned",
)

st.subheader("transform mode: contextual buttons")
TRANSFORM_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 20,
            "top": 20,
            "width": 60,
            "height": 60,
            "fill": "#ff0000",
            "stroke": "#000000",
            "strokeWidth": 1,
            "originX": "left",
            "originY": "top",
        },
        {
            "type": "rect",
            "left": 40,
            "top": 40,
            "width": 60,
            "height": 60,
            "fill": "#00ff00",
            "stroke": "#000000",
            "strokeWidth": 1,
            "originX": "left",
            "originY": "top",
        },
    ]
}
result_transform = st_canvas(
    height=200,
    width=300,
    drawing_mode="transform",
    initial_drawing=TRANSFORM_SEED,
    key="toolbar_transform",
)
st.code(json.dumps(result_transform.json_data), language="json")
