import os

import numpy as np
import streamlit.components.v1 as components

_RELEASE = False  # on packaging, pass this to True

if not _RELEASE:
    _component_func = components.declare_component(
        "st_canvas", url="http://localhost:3001",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("st_canvas", path=build_dir)


def st_canvas(
    brush_width: int = 20,
    brush_color: str = "black",
    background_color: str = "#eee",
    height: int = 400,
    width: int = 600,
    drawing_mode: str = "freedraw",
    key=None,
) -> np.array:
    """Create a drawing canvas in Streamlit app. Retrieve the RGBA image data into a 4D numpy array (r, g, b, alpha)
    on mouse up event.
        :param brush_width: Width of drawing brush in pixels.
        :param brush_color: Color of drawing brush in hex.
        :param background_color: Color of canvas background in hex.
        :param height: Height of canvas in pixels.
        :param width: Width of canvas in pixels.
        :param drawing_mode: Enable free drawing when "freedraw", object manipulation when "transform", line drawing when "line".
        :param key: An optional string to use as the unique key for the widget.
        Assign a key so the component is not remount every time the script is rerun.
        :return: Reshaped RGBA image 4D numpy array (r, g, b, alpha)
        """
    component_value = _component_func(
        brushWidth=brush_width,
        brushColor=brush_color,
        backgroundColor=background_color,
        canvasHeight=height,
        canvasWidth=width,
        drawingMode=drawing_mode,
        key=key,
        default=None,
    )
    if component_value is None:
        return None

    w = component_value["width"]
    h = component_value["height"]
    return np.reshape(component_value["data"], (h, w, 4))
