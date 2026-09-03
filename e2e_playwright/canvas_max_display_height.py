"""Streamlit app for E2E testing `max_display_height`."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("max_display_height E2E tests")

SEED = {
    "objects": [
        {
            "type": "Rect",
            "left": 50,
            "top": 500,
            "width": 60,
            "height": 40,
            "fill": "rgba(255, 165, 0, 0.3)",
            "stroke": "#000000",
            "strokeWidth": 2,
        }
    ]
}

st.subheader("capped")
result_capped = st_canvas(
    height=800,
    width=300,
    drawing_mode="transform",
    initial_drawing=SEED,
    max_display_height=200,
    key="capped",
)
st.code(json.dumps(result_capped.json_data), language="json")

st.subheader("uncapped control")
result_uncapped = st_canvas(
    height=800,
    width=300,
    drawing_mode="transform",
    initial_drawing=SEED,
    key="uncapped",
)
st.code(json.dumps(result_uncapped.json_data), language="json")
