"""Streamlit app for E2E testing of st_canvas behaviours beyond drawing
geometry: update_streamlit gating, initial_drawing round-trip,
return_image_data, and behaviour inside st.form."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.title("Canvas behaviour E2E tests")

st.subheader("update_streamlit=False")
result_gated = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    update_streamlit=False,
    key="gated",
)
st.code(json.dumps(result_gated.json_data), language="json")

st.subheader("initial_drawing round-trip")
result_source = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="rect",
    key="roundtrip_source",
)
if result_source.json_data and result_source.json_data.get("objects"):
    st.session_state["roundtrip_saved"] = result_source.json_data
result_target = st_canvas(
    stroke_width=1,
    height=200,
    width=300,
    drawing_mode="edit",
    initial_drawing=st.session_state.get("roundtrip_saved"),
    key="roundtrip_target",
)
st.code(json.dumps(result_target.json_data), language="json")

st.subheader("return_image_data")
result_image = st_canvas(
    stroke_width=5,
    height=200,
    width=300,
    drawing_mode="freedraw",
    return_image_data=True,
    key="image_data",
)
if result_image.image_data is not None:
    st.write(f"image_data shape: {result_image.image_data.shape}")
else:
    st.write("image_data: None")

st.subheader("st.form")
with st.form("canvas_form"):
    result_form = st_canvas(
        stroke_width=1,
        height=200,
        width=300,
        drawing_mode="rect",
        key="form_canvas",
    )
    submitted = st.form_submit_button("Submit")
st.write(f"form submitted: {submitted}")
st.code(json.dumps(result_form.json_data if submitted else None), language="json")
