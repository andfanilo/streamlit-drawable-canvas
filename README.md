# Streamlit - Drawable Canvas

A Streamlit custom component for a free drawing canvas with [Fabric.js](http://fabricjs.com/).

![](./img/demo.gif)

## Installation

```shell script
pip install streamlit-drawable-canvas
```

## Example Usage

```python
import streamlit as st
from streamlit_drawable_canvas import st_canvas

# Specify brush parameters and drawing mode
stroke_width = st.sidebar.slider("Stroke width: ", 1, 100, 10)
stroke_color = st.sidebar.beta_color_picker("Stroke color hex: ")
bg_color = st.sidebar.beta_color_picker("Enter background color hex: ", "#eee")
drawing_mode = st.sidebar.selectbox("Drawing mode", ("freedraw", "line", "transform"))

# Create a canvas component
image_data = st_canvas(
    stroke_width,
    stroke_color,
    bg_color,
    height=150,
    drawing_mode=drawing_mode,
    key="canvas",
)

# Do something interesting with the image data
if image_data is not None:
    st.image(image_data)
```

## Development

### Install

- JS side

```shell script
cd frontend
npm install
```

- Python side

```shell script
conda create -n streamlit-drawable-canvas python=3.7
conda activate streamlit-drawable-canvas
pip install -e .
```

### Run

Both webpack dev server and Streamlit should run at the same time.

- JS side

```shell script
cd frontend
npm run start
```

- Python side

```shell script
streamlit run app.py
```

## References

- [React hooks - fabric](https://github.com/fabricjs/fabric.js/issues/5951#issuecomment-563427231)
- [Simulate Retina display](https://stackoverflow.com/questions/12243549/how-to-test-a-webpage-meant-for-retina-display)
- [High DPI Canvas](https://www.html5rocks.com/en/tutorials/canvas/hidpi/)
- [Drawing with FabricJS and TypeScript Part 2: Straight Lines](https://exceptionnotfound.net/drawing-with-fabricjs-and-typescript-part-2-straight-lines/)
- [Types for classes as values in TypeScript](https://2ality.com/2020/04/classes-as-values-typescript.html)
