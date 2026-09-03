"""Streamlit app for E2E testing `background_image_fit` (issues #103, #120).

A 100x100 solid-red image on a 300x200 canvas. Under "stretch" it covers
the whole canvas; under "contain" it scales uniformly to 200x200 and is
centred, leaving 50px empty margins left and right. Sampling a pixel in
those margins tells the two apart without any snapshot comparison.
"""

import streamlit as st
from PIL import Image

from streamlit_drawable_canvas import st_canvas

st.title("Background image fit E2E tests")

IMG = Image.new("RGB", (100, 100), (255, 0, 0))

for fit in ("stretch", "contain"):
    st.subheader(fit)
    st_canvas(
        height=200,
        width=300,
        background_image=IMG,
        background_image_fit=fit,
        drawing_mode="freedraw",
        key=f"bgfit_{fit}",
    )

# Third canvas: fit switchable at runtime, same image. Exercises the
# re-fit-without-re-fetch path in applyData (the URL is unchanged, so the
# background is not reloaded -- only rescaled).
st.subheader("switchable")
switchable_fit = st.radio("fit", ("stretch", "contain"), horizontal=True)
st_canvas(
    height=200,
    width=300,
    background_image=IMG,
    background_image_fit=switchable_fit,
    drawing_mode="freedraw",
    key="bgfit_switchable",
)
