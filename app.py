import matplotlib.pyplot as plt
import streamlit as st
from streamlit_drawable_canvas import st_canvas

st.title("Drawable Canvas")
st.sidebar.subheader("Configuration")

b_width = st.sidebar.slider("Brush width: ", 1, 100, 10)
b_color = st.sidebar.beta_color_picker("Enter brush color hex: ")
bg_color = st.sidebar.beta_color_picker("Enter background color hex: ", "#eee")
image_data = st_canvas(b_width, b_color, bg_color)
if image_data is not None:
    st.markdown(f"Displaying numpy data with imshow :")
    fig, ax = plt.subplots()
    ax.imshow(image_data)
    st.pyplot(fig)
