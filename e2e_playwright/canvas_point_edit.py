"""Streamlit app for E2E testing of edit mode's point-editing (0.12.0 §3)."""

import json

import streamlit as st

from streamlit_drawable_canvas import st_canvas

st.set_page_config(layout="wide")
st.title("Point editing E2E tests")

POLYGON_SEED = {
    "objects": [
        {
            "type": "polygon",
            "points": [
                {"x": 50, "y": 50},
                {"x": 150, "y": 50},
                {"x": 150, "y": 130},
                {"x": 50, "y": 130},
            ],
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
        }
    ]
}

LINE_SEED = {
    "objects": [
        {
            "type": "line",
            "x1": -50,
            "y1": -40,
            "x2": 50,
            "y2": 40,
            "left": 100,
            "top": 90,
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        }
    ]
}

RECT_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 50,
            "top": 50,
            "width": 100,
            "height": 80,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        }
    ]
}

CIRCLE_SEED = {
    "objects": [
        {
            "type": "circle",
            "left": 100,
            "top": 90,
            "radius": 40,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        }
    ]
}

CIRCLE_NONUNIFORM_SEED = {
    "objects": [
        {
            "type": "circle",
            "left": 100,
            "top": 90,
            "radius": 40,
            "scaleX": 1,
            "scaleY": 1.5,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        }
    ]
}

LOCKED_RECT_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 50,
            "top": 50,
            "width": 100,
            "height": 80,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
            "lockMovementX": True,
        }
    ]
}

TWO_RECTS_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 20,
            "top": 20,
            "width": 60,
            "height": 50,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        },
        {
            "type": "rect",
            "left": 150,
            "top": 100,
            "width": 60,
            "height": 50,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        },
    ]
}

FREEDRAW_SEED = {
    "objects": [
        {
            "type": "path",
            "left": 50,
            "top": 50,
            "fill": None,
            "stroke": "#000000",
            "strokeWidth": 2,
            "path": [
                ["M", 50, 50],
                ["Q", 70, 20, 90, 50],
                ["Q", 110, 80, 130, 50],
            ],
        }
    ]
}

LINE_ROTATED_SEED = {
    "objects": [
        {
            "type": "line",
            "x1": -50,
            "y1": 0,
            "x2": 50,
            "y2": 0,
            "left": 100,
            "top": 90,
            "angle": 30,
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        }
    ]
}

RECT_AND_CIRCLE_SEED = {
    "objects": [
        {
            "type": "rect",
            "left": 20,
            "top": 20,
            "width": 60,
            "height": 50,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "left",
            "originY": "top",
            "angle": 0,
        },
        {
            "type": "circle",
            "left": 220,
            "top": 60,
            "radius": 30,
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
            "originX": "center",
            "originY": "center",
        },
    ]
}

LEGACY_POLYGON_SEED = {
    "objects": [
        {
            "type": "path",
            "path": [
                ["M", 50, 50],
                ["L", 150, 50],
                ["L", 150, 130],
                ["L", 50, 130],
                ["z"],
            ],
            "fill": "#eeeeee",
            "stroke": "#000000",
            "strokeWidth": 2,
        }
    ]
}

SCENARIOS = [
    ("polygon", POLYGON_SEED, {}),
    ("line", LINE_SEED, {}),
    ("rect", RECT_SEED, {}),
    ("circle", CIRCLE_SEED, {}),
    ("circle_nonuniform", CIRCLE_NONUNIFORM_SEED, {}),
    ("locked_rect", LOCKED_RECT_SEED, {}),
    ("two_rects", TWO_RECTS_SEED, {}),
    ("freedraw", FREEDRAW_SEED, {}),
    ("disabled_rect", RECT_SEED, {"disabled": True}),
    ("legacy_polygon", LEGACY_POLYGON_SEED, {}),
    ("polygon_realtime", POLYGON_SEED, {"update_streamlit": True}),
    ("rect_undo", RECT_SEED, {}),
    ("polygon_reset", POLYGON_SEED, {}),
    ("line_rotated", LINE_ROTATED_SEED, {}),
    ("rect_and_circle", RECT_AND_CIRCLE_SEED, {}),
]

for name, seed, kwargs in SCENARIOS:
    st.subheader(name)
    result = st_canvas(
        fill_color="#eeeeee",
        stroke_width=2,
        stroke_color="#000000",
        height=200,
        width=300,
        drawing_mode="rect",
        initial_drawing=seed,
        key=f"pe_{name}",
        **kwargs,
    )
    st.code(json.dumps(result.json_data), language="json")
