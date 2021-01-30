# Streamlit - Drawable Canvas

Streamlit component which provides a sketching canvas using [Fabric.js](http://fabricjs.com/).

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://share.streamlit.io/andfanilo/streamlit-drawable-canvas-demo/master/app.py)

![](./img/demo.gif)

## Features

- Draw freely, lines, circles and boxes on the canvas, with options on stroke & fill
- Rotate, skew, scale, move any object of the canvas on demand
- Select a background color or image to draw on
- Get image data and every drawn object properties back to Streamlit !
- Choose to fetch back data in realtime or on demand with a button
- Undo, Redo or Drop canvas
- Save canvas data as JSON to reuse for another session

## Installation

```shell script
pip install streamlit-drawable-canvas
```

## Example Usage

Copy this code snippet:

```python
import pandas as pd
from PIL import Image
import streamlit as st
from streamlit_drawable_canvas import st_canvas

# Specify canvas parameters in application
stroke_width = st.sidebar.slider("Stroke width: ", 1, 25, 3)
stroke_color = st.sidebar.color_picker("Stroke color hex: ")
bg_color = st.sidebar.color_picker("Background color hex: ", "#eee")
bg_image = st.sidebar.file_uploader("Background image:", type=["png", "jpg"])
drawing_mode = st.sidebar.selectbox(
    "Drawing tool:", ("freedraw", "line", "rect", "circle", "transform")
)
realtime_update = st.sidebar.checkbox("Update in realtime", True)

# Create a canvas component
canvas_result = st_canvas(
    fill_color="rgba(255, 165, 0, 0.3)",  # Fixed fill color with some opacity
    stroke_width=stroke_width,
    stroke_color=stroke_color,
    background_color="" if bg_image else bg_color,
    background_image=Image.open(bg_image) if bg_image else None,
    update_streamlit=realtime_update,
    height=150,
    drawing_mode=drawing_mode,
    key="canvas",
)

# Do something interesting with the image data and paths
if canvas_result.image_data is not None:
    st.image(canvas_result.image_data)
if canvas_result.json_data is not None:
    st.dataframe(pd.json_normalize(canvas_result.json_data["objects"]))
```

Consult the `st_canvas` API docs for more information on each argument.

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

### Cypress integration tests

- Install Cypress: `cd e2e; npm i` or `npx install cypress` (with `--force` if cache problem)
- Start Streamlit frontend server: `cd streamlit_drawable_canvas/frontend; npm run start`
- Start Streamlit test script: `streamlit run e2e/app_to_test.py`
- Start Cypress app: `cd e2e; npm run cypress:open`

## References

- [react-sketch](https://github.com/tbolis/react-sketch)
- [React hooks - fabric](https://github.com/fabricjs/fabric.js/issues/5951#issuecomment-563427231)
- [Simulate Retina display](https://stackoverflow.com/questions/12243549/how-to-test-a-webpage-meant-for-retina-display)
- [High DPI Canvas](https://www.html5rocks.com/en/tutorials/canvas/hidpi/)
- [Drawing with FabricJS and TypeScript Part 2: Straight Lines](https://exceptionnotfound.net/drawing-with-fabricjs-and-typescript-part-2-straight-lines/)
- [Drawing with FabricJS and TypeScript Part 7: Undo/Redo](https://exceptionnotfound.net/drawing-with-fabricjs-and-typescript-part-7-undo-redo/)
- [Types for classes as values in TypeScript](https://2ality.com/2020/04/classes-as-values-typescript.html)
- [Working with iframes in Cypress](https://www.cypress.io/blog/2020/02/12/working-with-iframes-in-cypress/)
- [How to use useReducer in React Hooks for performance optimization](https://medium.com/crowdbotics/how-to-use-usereducer-in-react-hooks-for-performance-optimization-ecafca9e7bf5)
- [Understanding React Default Props](https://blog.bitsrc.io/understanding-react-default-props-5c50401ed37d)
- [How to avoid passing callbacks down?](https://reactjs.org/docs/hooks-faq.html#how-to-avoid-passing-callbacks-down)
- [Examples of the useReducer Hook](https://daveceddia.com/usereducer-hook-examples/) The `useRef` hook allows you to create a persistent ref to a DOM node, or really to any value. React will persist this value between re-renders (between calls to your component function).
- [CSS filter generator to convert from black to target hex color](https://codepen.io/sosuke/pen/Pjoqqp)
- [When does React re-render components?](https://felixgerschau.com/react-rerender-components/#when-does-react-re-render)
- [Immutable Update Patterns](https://redux.js.org/recipes/structuring-reducers/immutable-update-patterns)
- Icons by [Freepik](https://www.flaticon.com/authors/freepik), [Google](https://www.flaticon.com/authors/google), [Mavadee](https://www.flaticon.com/authors/mavadee).
