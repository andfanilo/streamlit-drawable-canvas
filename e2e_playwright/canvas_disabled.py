"""Streamlit app for E2E testing `disabled=True` (issue #140).

Canvas 0 is disabled and seeded with a drawing; canvas 1 is the same canvas
enabled, as the control -- the drag that must do nothing on the first must
demonstrably do something on the second.
"""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("Canvas disabled E2E tests")

SEED = {
    "objects": [
        {
            "type": "Rect",
            "left": 50,
            "top": 50,
            "width": 60,
            "height": 40,
            "fill": "rgba(255, 165, 0, 0.3)",
            "stroke": "#000000",
            "strokeWidth": 2,
        }
    ]
}

st.subheader("disabled")
disabled_result = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=SEED,
    display_toolbar=True,  # must still be hidden, because disabled wins
    key="dis_on",
    disabled=True,
)
st.code(json.dumps(disabled_result.json_data), language="json")

st.subheader("enabled control")
enabled_result = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=SEED,
    display_toolbar=True,
    key="dis_off",
    disabled=False,
)
st.code(json.dumps(enabled_result.json_data), language="json")
