"""Streamlit app for E2E testing background/reset/round-trip interactions."""

import json

import streamlit as st
from PIL import Image

from streamlit_drawable_canvas import st_canvas

st.title("Background color E2E tests")

IMG = Image.new("RGB", (100, 100), (255, 0, 0))

with_image = st.checkbox("background image")
result = st_canvas(
    stroke_width=10,
    stroke_color="#008000",
    background_color="#eee",
    background_image=IMG if with_image else None,
    height=200,
    width=300,
    drawing_mode="freedraw",
    key="canvas1",
)
st.code(json.dumps(result.json_data), language="json")

st.subheader("initial_drawing round-trip")
result_round_trip = st_canvas(
    height=200,
    width=300,
    drawing_mode="freedraw",
    initial_drawing=result.json_data,
    key="canvas2",
)
st.code(json.dumps(result_round_trip.json_data), language="json")
