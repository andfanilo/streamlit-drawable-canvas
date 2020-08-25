import os
from dataclasses import dataclass

import numpy as np
from PIL import Image
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


@dataclass
class CanvasResult:
    image_data: np.array = None
    json_data: dict = None


def st_canvas(
    fill_color: str = "#eee",
    stroke_width: int = 20,
    stroke_color: str = "black",
    background_color: str = "transparent",
    background_image: Image = None,
    height: int = 400,
    width: int = 600,
    drawing_mode: str = "freedraw",
    key=None,
) -> CanvasResult:
    """Create a drawing canvas in Streamlit app. Retrieve the RGBA image data into a 4D numpy array (r, g, b, alpha)
    on mouse up event.
        :param fill_color: Color of fill for Rect in CSS color property.
        :param stroke_width: Width of drawing brush in CSS color property.
        :param stroke_color: Color of drawing brush in hex.
        :param background_color: Color of canvas background in CSS color property or "transparent". Transparent if background_image is specified
        :param background_image: Pillow Image for background. Size should be exactly size of canvas.
        :param height: Height of canvas in pixels.
        :param width: Width of canvas in pixels.
        :param drawing_mode: Enable free drawing when "freedraw", object manipulation when "transform", "line", "rect".
        :param key: An optional string to use as the unique key for the widget.
        Assign a key so the component is not remount every time the script is rerun.
        :return: Reshaped RGBA image 4D numpy array (r, g, b, alpha), and canvas raw JSON representation
        """
    component_value = _component_func(
        fillColor=fill_color,
        strokeWidth=stroke_width,
        strokeColor=stroke_color,
        backgroundColor=background_color if not background_image else "transparent",
        backgroundImage=np.array(background_image.convert("RGBA")).flatten().tolist()
        if background_image
        else None,
        canvasHeight=height,
        canvasWidth=width,
        drawingMode=drawing_mode,
        key=key,
        default=None,
    )
    if component_value is None:
        return CanvasResult

    w = component_value["width"]
    h = component_value["height"]
    return CanvasResult(
        np.reshape(component_value["data"], (h, w, 4)), component_value["raw"]
    )
