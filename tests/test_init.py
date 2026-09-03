from __future__ import annotations

import pytest

from streamlit_drawable_canvas import CanvasResult, st_canvas


def test_st_canvas_is_callable():
    assert callable(st_canvas)


def test_canvas_result_json_data():
    result = CanvasResult(
        json_data={"objects": []}, image_data_url=None, return_image_data=False
    )
    assert result.json_data == {"objects": []}


def test_canvas_result_image_data_raises_when_not_requested():
    result = CanvasResult(
        json_data={"objects": []}, image_data_url=None, return_image_data=False
    )
    with pytest.raises(RuntimeError, match="return_image_data"):
        _ = result.image_data


def test_canvas_result_image_data_none_when_requested_but_no_data_url():
    result = CanvasResult(json_data=None, image_data_url=None, return_image_data=True)
    assert result.image_data is None


def test_canvas_result_image_data_decodes_data_url():
    numpy = pytest.importorskip("numpy")
    Image = pytest.importorskip("PIL.Image")
    import base64
    import io

    buf = io.BytesIO()
    Image.new("RGBA", (2, 3), (10, 20, 30, 255)).save(buf, format="PNG")
    data_url = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    result = CanvasResult(
        json_data=None, image_data_url=data_url, return_image_data=True
    )
    arr = result.image_data
    assert isinstance(arr, numpy.ndarray)
    assert arr.shape == (3, 2, 4)  # numpy shape is (height, width, channels)
