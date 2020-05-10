import matplotlib.pyplot as plt
import numpy as np
import streamlit as st

st.register_component("drawable_canvas", url="http://localhost:3001")

st.title("Drawable Canvas")
st.sidebar.subheader("Configuration")

brush_width = st.sidebar.slider("Brush width: ", 1, 100, 10)
brush_color = st.sidebar.text_input("Enter brush color hex: ", "black")
bg_color = st.sidebar.text_input("Enter background color hex: ", "#eee")
image_data = st.drawable_canvas(
    brush_width=brush_width,
    brush_color=brush_color,
    background_color=bg_color,
    height=400,
    width=600,
    key="canvas",  # key is necessary so Streamlit does not remount component everytime you change a prop
    default=None
)
if image_data:
    w = image_data['width']
    h = image_data['height']
    data = np.reshape(image_data['data'], (h, w, 4))
    st.markdown(f"Displaying numpy data with imshow :")
    fig, ax = plt.subplots()
    ax.imshow(data)
    st.pyplot(fig)
