"""Manual smoke-test app for the dev loop (`just dev` + `just run`)."""

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.header("streamlit-drawable-canvas demo")

canvas_result = st_canvas(
    fill_color="rgba(255, 165, 0, 0.3)",
    stroke_width=10,
    stroke_color="green",
    background_color="#eee",
    height=150,
    width=500,
    drawing_mode="freedraw",
    return_image_data=True,
    key="canvas",
)

if canvas_result.image_data is not None:
    st.image(canvas_result.image_data)
if canvas_result.json_data is not None:
    st.dataframe(canvas_result.json_data["objects"])
