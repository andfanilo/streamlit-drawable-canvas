import pandas as pd
from PIL import Image
import streamlit as st
from streamlit_drawable_canvas import st_canvas

st.set_option("deprecation.showfileUploaderEncoding", False)

st.title("Drawable Canvas")
st.markdown(
    """
Draw on the canvas, get the image data back into Python !
* Doubleclick to remove the selected object when not in drawing mode
"""
)
st.sidebar.header("Configuration")

# Specify brush parameters and drawing mode
stroke_width = st.sidebar.slider("Stroke width: ", 1, 100, 10)
stroke_color = st.sidebar.beta_color_picker("Stroke color hex: ")
bg_color = st.sidebar.beta_color_picker("Background color hex: ", "#eee")
bg_image = st.sidebar.file_uploader("Background image:", type=["png", "jpg"])
drawing_mode = st.sidebar.selectbox(
    "Drawing tool:", ("freedraw", "line", "rect", "transform")
)

# Create a canvas component
canvas_result = st_canvas(
    fill_color="rgba(255, 165, 0, 0.3)",  # Fixed fill color with some opacity
    stroke_width=stroke_width,
    stroke_color=stroke_color,
    background_color="" if bg_image else bg_color,
    background_image=Image.open(bg_image) if bg_image else None,
    height=150,
    drawing_mode=drawing_mode,
    key="canvas",
)

# Do something interesting with the image data
if canvas_result.image_data is not None:
    st.image(canvas_result.image_data)
    st.dataframe(pd.json_normalize(canvas_result.json_data["objects"]))
