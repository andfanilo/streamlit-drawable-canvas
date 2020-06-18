# Streamlit - Drawable Canvas

A Streamlit custom component for a free drawing canvas with [Fabric.js](http://fabricjs.com/).

![](./img/demo.gif)

## Install

```shell script
pip install -i https://test.pypi.org/simple/ --no-deps streamlit-drawable-canvas
```

## Run

```shell script
streamlit run app.py
```

## Development 

### Install

* JS side

```shell script
cd frontend
npm install
```

* Python side 

```shell script
conda create -n streamlit-d3 python=3.7
conda activate streamlit-d3
pip install streamlit-0.61.0-py2.py3-none-any.whl
```

### Run

* JS side

```shell script
cd frontend
npm run start
```

* Python side

```shell script
streamlit run app.py
```

### Usage

`st_canvas` accepts as arguments :
* brush_width as number (defauts to 20)
* brush_color as CSS color (string or HEX, defaults to black)
* background_color as CSS color (string or HEX, defaults to #eee)
* width of canvas. To change it you must force-reload app or change key. Defaults to 400
* height of canvas. To change it you must force-reload app or change key. Defaults to 400
* key, so Streamlit does not rebuild the canvas everytime you change arguments
