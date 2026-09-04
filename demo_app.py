"""Manual smoke-test app for the dev loop (`just dev` + `just demo`)."""

import io
import tempfile
from pathlib import Path

import streamlit as st
from PIL import Image, ImageDraw

from streamlit_drawable_canvas import st_canvas

MODES = ("freedraw", "line", "rect", "circle", "point", "polygon", "text", "edit")

MODE_HINTS = {
    "polygon": "Click to add vertices, each with a visible handle. Click the "
    "first vertex's handle to close the shape (needs 3+ vertices); click any "
    "other handle to remove that vertex.",
    "edit": "Drag to move, handles to scale/rotate. Select an object and use "
    "the toolbar's delete button to remove it. Click an already-selected "
    "polygon, line, rect, circle or text a second time (a separate click -- "
    "not a fast double-click) to re-enter editing: for text that resumes "
    "typing, for the other shapes it descends into point editing, where "
    "dragging a handle moves an individual vertex/endpoint/rim point "
    "instead of the whole shape.",
    "point": "Each click drops a point, drawn as a circle of the radius below.",
    "text": "Click to place text and start typing immediately. Click elsewhere "
    "(or Escape/blur) to finish.",
}

BG_SOURCES = ("None", "URL", "Local path", "Bytes", "PIL Image")

EDIT_MODE_SEED = {
    "objects": [
        {
            "type": "polygon",
            "points": [
                {"x": 50, "y": 50},
                {"x": 150, "y": 50},
                {"x": 150, "y": 130},
                {"x": 50, "y": 130},
            ],
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
        },
        {
            "type": "line",
            "x1": -50,
            "y1": -30,
            "x2": 50,
            "y2": 30,
            "left": 280,
            "top": 90,
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        },
        {
            "type": "rect",
            "left": 380,
            "top": 50,
            "width": 100,
            "height": 80,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
        },
        {
            "type": "circle",
            "left": 520,
            "top": 90,
            "radius": 40,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        },
    ]
}


@st.cache_resource
def _sample_image() -> Image.Image:
    """A generated-on-the-fly sample image."""
    img = Image.new("RGB", (600, 400), "#4B8BBE")
    draw = ImageDraw.Draw(img)
    draw.ellipse((150, 100, 450, 300), fill="#FFD43B")
    draw.text((220, 190), "sample bg", fill="#306998")
    return img


@st.cache_resource
def _sample_image_path() -> str:
    path = Path(tempfile.gettempdir()) / "streamlit_drawable_canvas_demo_bg.png"
    _sample_image().save(path)
    return str(path)


@st.cache_resource
def _sample_image_bytes() -> bytes:
    buf = io.BytesIO()
    _sample_image().save(buf, format="PNG")
    return buf.getvalue()


st.header("streamlit-drawable-canvas demo")

with st.sidebar:
    drawing_mode = st.selectbox("Drawing mode", MODES)
    stroke_width = st.slider("Stroke width", 1, 25, 10)
    stroke_color = st.color_picker("Stroke color", "#008000")
    fill_hex = st.color_picker("Fill color", "#FFA500")
    fill_opacity = st.slider("Fill opacity", 0.0, 1.0, 0.3)
    point_display_radius = st.slider(
        "Point radius", 1, 25, 3, disabled=drawing_mode != "point"
    )
    font_size = st.slider("Font size", 8, 72, 20, disabled=drawing_mode != "text")
    realtime_update = st.checkbox("Update in realtime", True)
    disabled = st.checkbox("Disabled (read-only)", False)
    background_image_fit = st.selectbox("Background image fit", ("stretch", "contain"))
    return_image_data = st.checkbox("Return image data", True)
    bg_source = st.selectbox(
        "background_image source",
        BG_SOURCES,
        help="Exercises all four input types st_canvas accepts for "
        "background_image: URL, local path, raw bytes, PIL Image.",
    )

red, green, blue = (int(fill_hex[i : i + 2], 16) for i in (1, 3, 5))

if bg_source == "None":
    background_image = None
elif bg_source == "URL":
    background_image = "https://static.streamlit.io/examples/cat.jpg"
elif bg_source == "Local path":
    background_image = _sample_image_path()
elif bg_source == "Bytes":
    background_image = _sample_image_bytes()
else:
    background_image = _sample_image()

if drawing_mode in MODE_HINTS:
    st.caption(MODE_HINTS[drawing_mode])
if not realtime_update:
    st.caption(
        "Realtime updates off -- nothing reaches Python until you force a "
        "send. The toolbar is pinned open for this reason; its first button "
        "commits the drawing."
    )

canvas_result = st_canvas(
    fill_color=f"rgba({red}, {green}, {blue}, {fill_opacity})",
    stroke_width=stroke_width,
    stroke_color=stroke_color,
    background_color="#eee",
    background_image=background_image,
    update_streamlit=realtime_update,
    height=400,
    width=600,
    drawing_mode=drawing_mode,
    disabled=disabled,
    background_image_fit=background_image_fit,
    point_display_radius=point_display_radius,
    return_image_data=return_image_data,
    font_size=font_size,
    initial_drawing=EDIT_MODE_SEED if drawing_mode == "edit" else None,
    key="canvas",
)

if return_image_data and canvas_result.image_data is not None:
    st.image(canvas_result.image_data)
if canvas_result.json_data is not None:
    # Every value stringified: `path` is a nested mixed-type list Arrow can't type.
    st.dataframe(
        [
            {k: str(v) for k, v in obj.items()}
            for obj in canvas_result.json_data["objects"]
        ]
    )

st.divider()
st.subheader("initial_drawing round-trip")
st.caption(
    "The canvas above's `json_data` fed back in as `initial_drawing` on a second, "
    "independent canvas -- drag its objects around in edit mode."
)
st_canvas(
    fill_color=f"rgba({red}, {green}, {blue}, {fill_opacity})",
    stroke_width=stroke_width,
    stroke_color=stroke_color,
    background_color="#eee",
    height=400,
    width=600,
    drawing_mode="edit",
    initial_drawing=canvas_result.json_data,
    key="canvas_round_trip",
)

st.divider()
st.subheader("Canvas inside st.form")
st.caption(
    "A form is the cleanest way to get only the finished drawing: the canvas "
    "keeps `update_streamlit=True`, so it stores every stroke, but the form "
    "holds the rerun back until Submit. No toolbar button needed. The canvas "
    "is not a trigger widget, so it never submits the form by itself. "
    "Draw, then click Submit."
)
with st.form("canvas_form"):
    form_canvas_result = st_canvas(
        stroke_color=stroke_color,
        background_color="#eee",
        height=200,
        width=300,
        drawing_mode="freedraw",
        key="canvas_form",
    )
    submitted = st.form_submit_button("Submit")
if submitted:
    object_count = len(form_canvas_result.json_data["objects"])
    st.write(f"Submitted {object_count} object(s).")
