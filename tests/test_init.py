from __future__ import annotations

import pytest

from streamlit_drawable_canvas import CanvasResult, boxes_to_drawing, st_canvas


def test_st_canvas_is_callable():
    assert callable(st_canvas)


def test_st_canvas_rejects_non_positive_max_display_height():
    with pytest.raises(ValueError, match="max_display_height"):
        st_canvas(max_display_height=0)
    with pytest.raises(ValueError, match="max_display_height"):
        st_canvas(max_display_height=-10)


def test_st_canvas_rejects_edit_drawing_mode():
    with pytest.raises(ValueError, match="toolbar"):
        st_canvas(drawing_mode="edit")


def test_st_canvas_rejects_transform_drawing_mode():
    with pytest.raises(ValueError, match="toolbar"):
        st_canvas(drawing_mode="transform")


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


# --- drawing_mode="labeled_rect" -------------------------------------------


def test_st_canvas_accepts_labeled_rect_drawing_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="labeled_rect", label="person")
    assert captured["data"]["drawingMode"] == "labeled_rect"
    assert captured["data"]["label"] == "person"


def test_st_canvas_rejects_label_outside_labeled_rect_mode():
    with pytest.raises(ValueError, match="labeled_rect"):
        st_canvas(drawing_mode="rect", label="person")


def test_st_canvas_allows_empty_label_in_every_mode(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    for mode in ("rect", "freedraw", "text", "labeled_rect"):
        st_canvas(drawing_mode=mode, label="")
    assert captured["data"]["drawingMode"] == "labeled_rect"


def test_font_size_docstring_applies_to_labeled_rect_too(monkeypatch):
    captured = {}

    def fake_out(*, data, **kwargs):
        captured["data"] = data
        return {"drawing": {"raw": data["initialDrawing"], "data": None}}

    monkeypatch.setattr("streamlit_drawable_canvas.out", fake_out)
    st_canvas(drawing_mode="labeled_rect", font_size=42)
    assert captured["data"]["fontSize"] == 42


# --- CanvasResult.boxes ------------------------------------------------


def _labeled_rect(label="person", left=10, top=20, width=100, height=50, **extra):
    obj = {
        "type": "LabeledRect",
        "label": label,
        "left": left,
        "top": top,
        "width": width,
        "height": height,
        "scaleX": 1,
        "scaleY": 1,
    }
    obj.update(extra)
    return obj


def test_boxes_applies_scale_correction():
    result = CanvasResult(
        json_data={
            "objects": [_labeled_rect(width=100, height=50, scaleX=1.5, scaleY=2)]
        },
        image_data_url=None,
        return_image_data=False,
    )
    assert result.boxes == [
        {"label": "person", "left": 10, "top": 20, "width": 150, "height": 100}
    ]


def test_boxes_normalizes_center_origin_to_top_left():
    result = CanvasResult(
        json_data={
            "objects": [
                _labeled_rect(
                    left=60,
                    top=45,
                    width=100,
                    height=50,
                    originX="center",
                    originY="center",
                )
            ]
        },
        image_data_url=None,
        return_image_data=False,
    )
    assert result.boxes == [
        {"label": "person", "left": 10, "top": 20, "width": 100, "height": 50}
    ]


def test_boxes_filters_to_labeled_rect_only():
    result = CanvasResult(
        json_data={
            "objects": [
                {"type": "Rect", "left": 0, "top": 0, "width": 10, "height": 10},
                {"type": "Path", "path": []},
                {"type": "IText", "text": "hello"},
                _labeled_rect(label="car"),
            ]
        },
        image_data_url=None,
        return_image_data=False,
    )
    assert len(result.boxes) == 1
    assert result.boxes[0]["label"] == "car"


def test_boxes_empty_for_no_json_data():
    result = CanvasResult(json_data=None, image_data_url=None, return_image_data=False)
    assert result.boxes == []


def test_boxes_empty_for_object_less_canvas():
    result = CanvasResult(
        json_data={"objects": []}, image_data_url=None, return_image_data=False
    )
    assert result.boxes == []


# --- CanvasResult.boxes_in_image_space / background_fit -----------------


def _fit(natural_width, natural_height, scale_x, scale_y, offset_x=0, offset_y=0):
    return {
        "natural_width": natural_width,
        "natural_height": natural_height,
        "scale_x": scale_x,
        "scale_y": scale_y,
        "offset_x": offset_x,
        "offset_y": offset_y,
    }


def test_boxes_in_image_space_none_without_background_fit():
    result = CanvasResult(
        json_data={"objects": [_labeled_rect()]},
        image_data_url=None,
        return_image_data=False,
        background_fit=None,
    )
    assert result.boxes_in_image_space is None
    assert result.background_fit is None


def test_boxes_in_image_space_stretch_fit():
    # 2000x1000 image stretched independently onto a 600x400 canvas.
    result = CanvasResult(
        json_data={"objects": [_labeled_rect(left=60, top=40, width=120, height=80)]},
        image_data_url=None,
        return_image_data=False,
        background_fit=_fit(2000, 1000, scale_x=0.3, scale_y=0.4),
    )
    [box] = result.boxes_in_image_space
    assert box == {
        "label": "person",
        "left": pytest.approx(200),
        "top": pytest.approx(100),
        "width": pytest.approx(400),
        "height": pytest.approx(200),
    }


def test_boxes_in_image_space_contain_fit():
    # 2000x1000 image (2:1) letterboxed into a 600x400 canvas -> scale 0.3
    # on both axes, vertical margin (offset_y) of (400 - 300) / 2 = 50.
    result = CanvasResult(
        json_data={"objects": [_labeled_rect(left=60, top=80, width=120, height=60)]},
        image_data_url=None,
        return_image_data=False,
        background_fit=_fit(2000, 1000, scale_x=0.3, scale_y=0.3, offset_y=50),
    )
    [box] = result.boxes_in_image_space
    assert box == {
        "label": "person",
        "left": pytest.approx(200),
        "top": pytest.approx(100),
        "width": pytest.approx(400),
        "height": pytest.approx(200),
    }


# --- boxes_to_drawing -----------------------------------------------------


def test_boxes_to_drawing_round_trips_through_boxes():
    boxes = [
        {"label": "person", "left": 10, "top": 20, "width": 100, "height": 50},
        {"label": "", "left": 0, "top": 0, "width": 30, "height": 30},
    ]
    result = CanvasResult(
        json_data=boxes_to_drawing(boxes), image_data_url=None, return_image_data=False
    )
    assert result.boxes == boxes


def test_boxes_to_drawing_empty_list():
    assert boxes_to_drawing([]) == {"objects": []}


def test_boxes_to_drawing_defaults_label_to_empty_string():
    drawing = boxes_to_drawing([{"left": 0, "top": 0, "width": 10, "height": 10}])
    assert drawing["objects"][0]["label"] == ""
