"""Streamlit app for E2E testing of the labeled-rect tool."""

import json

import streamlit as st
from PIL import Image

from streamlit_drawable_canvas import boxes_to_drawing, st_canvas

st.set_page_config(layout="wide")
st.title("Labeled rect E2E tests")

st.subheader("draw_basic")
result_basic = st_canvas(
    height=200,
    width=300,
    drawing_mode="labeled_rect",
    label="pedestrian",
    font_size=30,
    key="lr_draw_basic",
)
st.code(json.dumps(result_basic.json_data), language="json")

st.subheader("label_switch")
switch_label = st.text_input("label", "cat", key="lr_label_switch_input")
result_switch = st_canvas(
    height=200,
    width=300,
    drawing_mode="labeled_rect",
    label=switch_label,
    key="lr_label_switch",
)
st.code(json.dumps(result_switch.json_data), language="json")

st.subheader("empty_label")
result_empty = st_canvas(
    height=200,
    width=300,
    drawing_mode="labeled_rect",
    label="",
    key="lr_empty_label",
)
st.code(json.dumps(result_empty.json_data), language="json")

RELABEL_SEED = {
    "objects": [
        {
            "type": "LabeledRect",
            "label": "old",
            "left": 50,
            "top": 50,
            "width": 100,
            "height": 60,
            "fill": "rgba(0,0,0,0)",
            "stroke": "#000000",
            "strokeWidth": 2,
            "fontSize": 20,
            "originX": "left",
            "originY": "top",
            "angle": 0,
            "scaleX": 1,
            "scaleY": 1,
            "lockRotation": True,
        }
    ]
}

st.subheader("relabel")
result_relabel = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=RELABEL_SEED,
    key="lr_relabel",
)
st.code(json.dumps(result_relabel.json_data), language="json")

st.subheader("scale")
result_scale = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=RELABEL_SEED,
    key="lr_scale",
)
st.code(json.dumps(result_scale.json_data), language="json")

st.subheader("no_rotation")
result_rotation = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=RELABEL_SEED,
    key="lr_no_rotation",
)
st.code(json.dumps(result_rotation.json_data), language="json")

IMG = Image.new("RGB", (2000, 1000), (0, 128, 255))

st.subheader("bg_stretch")
result_bg_stretch = st_canvas(
    height=400,
    width=600,
    background_image=IMG,
    background_image_fit="stretch",
    drawing_mode="labeled_rect",
    label="box",
    key="lr_bg_stretch",
)
st.code(json.dumps(result_bg_stretch.background_fit), language="json")

st.subheader("bg_contain")
result_bg_contain = st_canvas(
    height=400,
    width=600,
    background_image=IMG,
    background_image_fit="contain",
    drawing_mode="labeled_rect",
    label="box",
    key="lr_bg_contain",
)
st.code(json.dumps(result_bg_contain.background_fit), language="json")

st.subheader("bg_none")
result_bg_none = st_canvas(
    height=200,
    width=300,
    drawing_mode="labeled_rect",
    label="box",
    key="lr_bg_none",
)
st.code(json.dumps(result_bg_none.background_fit), language="json")

ROUNDTRIP_BOXES = [
    {"label": "roundtrip", "left": 15, "top": 25, "width": 90, "height": 45}
]

st.subheader("roundtrip")
result_roundtrip = st_canvas(
    height=200,
    width=300,
    drawing_mode="rect",
    initial_drawing=boxes_to_drawing(ROUNDTRIP_BOXES),
    key="lr_roundtrip",
)
st.code(json.dumps(result_roundtrip.boxes), language="json")
