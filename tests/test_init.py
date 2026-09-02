from __future__ import annotations

import numpy as np

from streamlit_drawable_canvas import CanvasResult, st_canvas


def test_st_canvas_is_callable():
    assert callable(st_canvas)


def test_canvas_result_fields():
    result = CanvasResult(image_data=np.zeros((1, 1, 4)), json_data={"objects": []})
    assert isinstance(result.image_data, np.ndarray)
    assert result.json_data == {"objects": []}


def test_canvas_result_defaults_to_none():
    result = CanvasResult()
    assert result.image_data is None
    assert result.json_data is None
