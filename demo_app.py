"""Manual smoke-test app for the dev loop (`just dev` + `just run`)."""

import streamlit as st

from streamlit_drawable_canvas import st_canvas

MODES = ("freedraw", "line", "rect", "circle", "point", "polygon", "transform")

MODE_HINTS = {
    "polygon": "Click to add points. Double-click removes the last ones; "
    "**right-click closes the polygon**.",
    "transform": "Drag to move, handles to scale/rotate. Double-click deletes "
    "the selected object.",
    "point": "Each click drops a point, drawn as a circle of the radius below.",
}

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
    realtime_update = st.checkbox("Update in realtime", True)
    display_toolbar = st.checkbox("Display toolbar", True)
    return_image_data = st.checkbox("Return image data", True)

red, green, blue = (int(fill_hex[i : i + 2], 16) for i in (1, 3, 5))

if drawing_mode in MODE_HINTS:
    st.caption(MODE_HINTS[drawing_mode])
if not realtime_update:
    st.caption(
        "Realtime updates off -- right-click, or the toolbar's send button, "
        "still forces a send."
    )

canvas_result = st_canvas(
    fill_color=f"rgba({red}, {green}, {blue}, {fill_opacity})",
    stroke_width=stroke_width,
    stroke_color=stroke_color,
    background_color="#eee",
    update_streamlit=realtime_update,
    height=400,
    width=600,
    drawing_mode=drawing_mode,
    display_toolbar=display_toolbar,
    point_display_radius=point_display_radius,
    return_image_data=return_image_data,
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
