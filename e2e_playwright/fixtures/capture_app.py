"""Streamlit app used only to capture Fabric 4 JSON ground-truth fixtures.

Driven by scripts/capture_v4_fixtures.py via Playwright. Each st_canvas below
gets its own fixed-size canvas and a st.code(json.dumps(...)) readback so the
capture script can scrape the exact component_value it received, without
needing any other channel back to Python.

Not a general-purpose demo app -- see fabric-v4/README.md for what this
produces and why.
"""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

CANVAS_HEIGHT = 200
CANVAS_WIDTH = 300

st.header("Fabric v4 JSON fixture capture")

st.subheader("freedraw")
freedraw_result = st_canvas(
    drawing_mode="freedraw",
    key="freedraw",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=5,
    stroke_color="#000000",
    background_color="#eeeeee",
)
st.code(json.dumps(freedraw_result.json_data), language="json")

st.subheader("line")
line_result = st_canvas(
    drawing_mode="line",
    key="line",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#0000ff",
    background_color="#eeeeee",
)
st.code(json.dumps(line_result.json_data), language="json")

st.subheader("rect")
rect_result = st_canvas(
    drawing_mode="rect",
    key="rect",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#ff0000",
    fill_color="rgba(255, 0, 0, 0.3)",
    background_color="#eeeeee",
)
st.code(json.dumps(rect_result.json_data), language="json")

st.subheader("circle")
circle_result = st_canvas(
    drawing_mode="circle",
    key="circle",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#008000",
    fill_color="rgba(0, 128, 0, 0.3)",
    background_color="#eeeeee",
)
st.code(json.dumps(circle_result.json_data), language="json")

st.subheader("point")
point_result = st_canvas(
    drawing_mode="point",
    key="point",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=5,
    stroke_color="#800080",
    point_display_radius=8,
    background_color="#eeeeee",
)
st.code(json.dumps(point_result.json_data), language="json")

st.subheader("polygon")
polygon_result = st_canvas(
    drawing_mode="polygon",
    key="polygon",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#ff8c00",
    fill_color="rgba(255, 140, 0, 0.3)",
    background_color="#eeeeee",
)
st.code(json.dumps(polygon_result.json_data), language="json")

st.subheader("transform")
transform_mode = st.selectbox(
    "transform_mode", options=["rect", "transform"], key="transform_mode_select"
)
transform_result = st_canvas(
    drawing_mode=transform_mode,
    key="transform",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#a52a2a",
    fill_color="rgba(165, 42, 42, 0.3)",
    background_color="#eeeeee",
)
st.code(json.dumps(transform_result.json_data), language="json")

st.subheader("kitchen-sink")
kitchen_sink_mode = st.selectbox(
    "kitchen_sink_mode",
    options=["rect", "circle", "line", "freedraw", "point", "transform"],
    key="kitchen_sink_mode_select",
)
kitchen_sink_result = st_canvas(
    drawing_mode=kitchen_sink_mode,
    key="kitchen_sink",
    height=CANVAS_HEIGHT,
    width=CANVAS_WIDTH,
    stroke_width=3,
    stroke_color="#000000",
    fill_color="rgba(0, 0, 0, 0.3)",
    point_display_radius=6,
    background_color="#87ceeb",
)
st.code(json.dumps(kitchen_sink_result.json_data), language="json")
