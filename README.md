# Streamlit - Drawable Canvas

A Streamlit custom component for a free drawing canvas from [Fabric.js](http://fabricjs.com/).

## Install

```shell script
conda create -n streamlit-drawable-canvas python=3.7
conda activate streamlit-drawable-canvas 
pip install streamlit-0.58.0-py2.py3-none-any.whl

cd frontend
npm install
```

## Use

`st.drawable_canvas` accepts as arguments :
* brush_width as number (defauts to 20)
* brush_color as CSS color (string or HEX, defaults to black)
* background_color as CSS color (string or HEX, defaults to #eee)
* width of canvas. To change it you must force-reload app or change key. Defaults to 400
* height of canvas. To change it you must force-reload app or change key. Defaults to 400
* key, so Streamlit does not rebuild the canvas everytime you change arguments

## Run development setup

In a terminal :

```
cd frontend
npm run start
```

In another terminal :

```
streamlit run app.py
```
