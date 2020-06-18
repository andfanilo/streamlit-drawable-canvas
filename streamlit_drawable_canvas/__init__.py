import os

import numpy as np
import streamlit as st

_RELEASE = False  # on packaging, pass this to True

if not _RELEASE:
    _component_func = st.declare_component("st_canvas", url="http://localhost:3001",)
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = st.declare_component("st_canvas", path=build_dir)


def st_canvas(
    brush_width=20,
    brush_color="black",
    background_color="#eee",
    height=400,
    width=600,
    key="canvas",
):
    """ Validate inputs + Post-process image from canvas
        :param brush_width:
        :param brush_color:
        :param background_color:
        :param height:
        :param width:
        :param key:
        :return: Reshaped image
        """
    component_value = _component_func(
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
