import matplotlib.pyplot as plt
import numpy as np
import streamlit as st

dc = st.declare_component(url="http://localhost:3001")


@dc
def wrapper(
    f,
    brush_width=20,
    brush_color="black",
    background_color="#eee",
    height=400,
    width=600,
    key="canvas",
):
    """ Validate inputs + Post-process image from canvas
    :param f: Callback
    :param brush_width:
    :param brush_color:
    :param background_color:
    :param height:
    :param width:
    :param key:
    :return: Reshaped image
    """
    component_value = f(
        brush_width=brush_width,
        brush_color=brush_color,
        background_color=background_color,
        height=height,
        width=width,
        key=key,
        default=None,
    )

    if component_value is None:
        return None

    w = component_value["width"]
    h = component_value["height"]
    return np.reshape(component_value["data"], (h, w, 4))


st.register_component("drawable_canvas", dc)

st.title("Drawable Canvas")
st.sidebar.subheader("Configuration")

b_width = st.sidebar.slider("Brush width: ", 1, 100, 10)
b_color = st.sidebar.beta_color_picker("Enter brush color hex: ")
bg_color = st.sidebar.beta_color_picker("Enter background color hex: ", "#eee")
image_data = st.drawable_canvas(b_width, b_color, bg_color)
if image_data is not None:
    st.markdown(f"Displaying numpy data with imshow :")
    fig, ax = plt.subplots()
    ax.imshow(image_data)
    st.pyplot(fig)
