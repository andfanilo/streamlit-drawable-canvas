from __future__ import annotations

import pytest

from streamlit_drawable_canvas import CanvasResult, st_canvas


def test_st_canvas_is_callable():
    assert callable(st_canvas)


def test_st_canvas_rejects_non_positive_max_display_height():
    with pytest.raises(ValueError, match="max_display_height"):
        st_canvas(max_display_height=0)
    with pytest.raises(ValueError, match="max_display_height"):
        st_canvas(max_display_height=-10)


def test_st_canvas_accepts_text_drawing_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="text")
    assert captured["data"]["drawingMode"] == "text"


def test_fill_color_defaults_to_eee_outside_text_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="rect")
    assert captured["data"]["fillColor"] == "#eee"


def test_fill_color_defaults_to_stroke_color_in_text_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="text", stroke_color="blue")
    assert captured["data"]["fillColor"] == "blue"


def test_fill_color_explicit_value_respected_in_text_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="text", fill_color="red", stroke_color="blue")
    assert captured["data"]["fillColor"] == "red"


def test_font_size_passed_through(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(font_size=42)
    assert captured["data"]["fontSize"] == 42


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


def test_canvas_result_image_bytes_raises_when_not_requested():
    result = CanvasResult(
        json_data={"objects": []}, image_data_url=None, return_image_data=False
    )
    with pytest.raises(RuntimeError, match="return_image_data"):
        _ = result.image_bytes


def test_canvas_result_image_bytes_none_when_requested_but_no_data_url():
    result = CanvasResult(json_data=None, image_data_url=None, return_image_data=True)
    assert result.image_bytes is None


def test_canvas_result_image_bytes_decodes_data_url():
    import base64

    raw = b"\x89PNG\r\n\x1a\nnot a real png but bytes are bytes"
    data_url = f"data:image/png;base64,{base64.b64encode(raw).decode()}"

    result = CanvasResult(
        json_data=None, image_data_url=data_url, return_image_data=True
    )
    assert result.image_bytes == raw
