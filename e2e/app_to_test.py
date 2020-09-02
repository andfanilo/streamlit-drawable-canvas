import pandas as pd
import streamlit as st
from streamlit_drawable_canvas import st_canvas

st.header("End-to-end Cypress test")

canvas_result = st_canvas(
    fill_color="rgba(255, 165, 0, 0.3)",
    stroke_width=10,
    stroke_color="green",
    background_color="#eee",
    height=150,
    width=500,
    drawing_mode="freedraw",
    key="canvas",
)

if canvas_result.image_data is not None:
    st.image(canvas_result.image_data)
    st.dataframe(pd.json_normalize(canvas_result.json_data["objects"]))