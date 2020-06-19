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
conda create -n streamlit-drawable-canvas python=3.7
conda activate streamlit-drawable-canvas
pip install streamlit-0.61.0-py2.py3-none-any.whl
pip install -e .
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

## References 

* [React hooks - fabric](https://github.com/fabricjs/fabric.js/issues/5951#issuecomment-563427231)