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
    """Dataclass to store output of React Component

    Attributes
    ----------
    image_data: np.array
        RGBA Matrix of Image Data.
    json_data: dict
        JSON string of canvas and objects.
    """

    image_data: np.array = None
    json_data: dict = None


def _resize_img(img: Image, new_height: int = 700, new_width: int = 700) -> Image:
    """Resize the image to the provided resolution."""
    h_ratio = new_height / img.height
    w_ratio = new_width / img.width
    img = img.resize((int(img.width * w_ratio), int(img.height * h_ratio)))
    return img


def _img_to_array(img: Image) -> np.array:
    """Return RGBA array of PIL image."""
    return np.array(img.convert("RGBA")).flatten().tolist()


def st_canvas(
    fill_color: str = "#eee",
    stroke_width: int = 20,
    stroke_color: str = "black",
    background_color: str = "",
    background_image: Image = None,
    update_streamlit: bool = True,
    height: int = 400,
    width: int = 600,
    drawing_mode: str = "freedraw",
    initial_drawing: dict = None,
    display_toolbar: bool = True,
    key=None,
) -> CanvasResult:
    """Create a drawing canvas in Streamlit app. Retrieve the RGBA image data into a 4D numpy array (r, g, b, alpha)
    on mouse up event.

    Parameters
    ----------
    fill_color: str
        Color of fill for Rect in CSS color property. Defaults to "#eee".
    stroke_width: str
        Width of drawing brush in CSS color property. Defaults to 20.
    stroke_color: str
        Color of drawing brush in hex. Defaults to "black".
    background_color: str
        Color of canvas background in CSS color property. Defaults to "" which is transparent.
        Overriden by background_image.
        Note: Changing background_color will reset the drawing.
    background_image: Image
        Pillow Image to display behind canvas. 
        Automatically resized to canvas dimensions.
        Being behind the canvas, it is not sent back to Streamlit on mouse event.
    update_streamlit: bool
        Whenever True, send canvas data to Streamlit when object/selection is updated or mouse up.
    height: int
        Height of canvas in pixels. Defaults to 400.
    width: int
        Width of canvas in pixels. Defaults to 600.
    drawing_mode: {'freedraw', 'transform', 'line', 'rect', 'circle', 'polygon'}
        Enable free drawing when "freedraw", object manipulation when "transform", "line", "rect", "circle", "polygon".
        Defaults to "freedraw".
    initial_drawing: dict
        Redraw canvas with given initial_drawing. If changed to None then empties canvas.
        Should generally be the `json_data` output from other canvas, which you can manipulate.
        Beware: if importing from a bigger/smaller canvas, no rescaling is done in the canvas,
        it should be ran on user's side.
    display_toolbar: bool
        Display the undo/redo/reset toolbar.
    key: str
        An optional string to use as the unique key for the widget.
        Assign a key so the component is not remount every time the script is rerun.
    
    Returns
    -------
    result: CanvasResult 
        `image_data` contains reshaped RGBA image 4D numpy array (r, g, b, alpha), 
        `json_data` stores the canvas/objects JSON representation which you can manipulate, store
        load and then reinject into another canvas through the `initial_drawing` argument.
    """
    # Resize background_image to canvas dimensions by default
    # Then override background_color
    if background_image:
        background_image = _resize_img(background_image, height, width)
        background_image = _img_to_array(background_image)
        background_color = ""

    # Clean initial drawing, override its background color
    initial_drawing = {"version": "4.4.0"} if initial_drawing is None else initial_drawing
    initial_drawing["background"] = background_color

    component_value = _component_func(
        fillColor=fill_color,
        strokeWidth=stroke_width,
        strokeColor=stroke_color,
        backgroundColor=background_color,
        backgroundImage=background_image,
        realtimeUpdateStreamlit=update_streamlit and (drawing_mode != 'polygon'),
        canvasHeight=height,
        canvasWidth=width,
        drawingMode=drawing_mode,
        initialDrawing=initial_drawing,
        displayToolbar=display_toolbar,
        key=key,
        default=None,
    )
    if component_value is None:
        return CanvasResult

    w = component_value["width"]
    h = component_value["height"]
    return CanvasResult(
        np.reshape(component_value["data"], (h, w, 4)), component_value["raw"],
    )
