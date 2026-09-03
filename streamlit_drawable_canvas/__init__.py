from __future__ import annotations

import base64
import hashlib
import importlib.metadata
import io
from collections import OrderedDict
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import streamlit as st

if TYPE_CHECKING:
    import numpy as np
    from PIL.Image import Image as PILImage

__version__ = importlib.metadata.version("streamlit-drawable-canvas")

out = st.components.v2.component(
    "streamlit-drawable-canvas.streamlit_drawable_canvas",
    js="index-*.js",
    css="index-*.css",
    html='<div class="canvas-root"></div>',
    isolate_styles=True,
)


class CanvasResult:
    """The result of an `st_canvas` call.

    Attributes
    ----------
    json_data: dict | None
        The Fabric.js canvas JSON representation of the drawing. Feed it back
        into another canvas's `initial_drawing` to restore or continue
        editing it.
    image_data: np.ndarray
        RGBA image data as a 4D numpy array (r, g, b, alpha). Only available
        when `return_image_data=True` was passed to `st_canvas`; accessing
        this attribute otherwise raises.
    """

    __slots__ = ("_image_data_url", "_return_image_data", "json_data")

    def __init__(
        self,
        json_data: dict[str, Any] | None,
        image_data_url: str | None,
        return_image_data: bool,
    ) -> None:
        self.json_data = json_data
        self._image_data_url = image_data_url
        self._return_image_data = return_image_data

    @property
    def image_data(self) -> np.ndarray | None:
        if not self._return_image_data:
            raise RuntimeError(
                "image_data was not requested. Pass return_image_data=True to "
                "st_canvas(), and install the image extra: "
                "pip install streamlit-drawable-canvas[image]"
            )
        if self._image_data_url is None:
            return None

        import numpy as np
        from PIL import Image

        _, encoded = self._image_data_url.split(";base64,", 1)
        img = Image.open(io.BytesIO(base64.b64decode(encoded)))
        return np.asarray(img)


# Content-addressed LRU cache for encoded background images: an unchanged
# background_image across reruns is re-encoded at most once. Shared across
# sessions -- the encoded value has no session-specific content.
_BG_IMAGE_CACHE_MAXSIZE = 32
_bg_image_cache: OrderedDict[str, str] = OrderedDict()


# Kept in sync with the `tools` registry in frontend/src/tools/index.ts, which
# silently falls back to freedraw on an unrecognized mode.
_VALID_DRAWING_MODES = frozenset(
    {"circle", "freedraw", "line", "point", "polygon", "rect", "transform"}
)

# Kept in sync with BackgroundImageFit in frontend/src/background.ts.
_VALID_BACKGROUND_IMAGE_FITS = frozenset({"contain", "stretch"})


def _looks_like_url(value: str) -> bool:
    return value.startswith(("http://", "https://", "data:"))


def _sniff_mime(raw: bytes) -> str:
    """Best-effort magic-byte sniff, without pulling in Pillow."""
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        return "image/webp"
    if raw.startswith(b"BM"):
        return "image/bmp"
    return "application/octet-stream"


def _encode_bytes_to_data_url(raw: bytes) -> str:
    digest = hashlib.md5(raw).hexdigest()
    cached = _bg_image_cache.get(digest)
    if cached is not None:
        _bg_image_cache.move_to_end(digest)
        return cached
    data_url = f"data:{_sniff_mime(raw)};base64,{base64.b64encode(raw).decode('ascii')}"
    _bg_image_cache[digest] = data_url
    if len(_bg_image_cache) > _BG_IMAGE_CACHE_MAXSIZE:
        _bg_image_cache.popitem(last=False)
    return data_url


def _resolve_background_image_url(
    background_image: str | Path | bytes | PILImage | None,
) -> str | None:
    """Resolve `background_image` to a URL the frontend can use directly.

    Accepts what `st.image` accepts: an http(s) URL, a data: URI, a local
    path, raw bytes, or a PIL Image. Only the PIL.Image branch imports Pillow,
    so the base (non-`[image]`) install stays functional for every other one.
    """
    if background_image is None:
        return None

    if isinstance(background_image, str):
        if _looks_like_url(background_image):
            return background_image
        return _encode_bytes_to_data_url(Path(background_image).read_bytes())

    if isinstance(background_image, Path):
        return _encode_bytes_to_data_url(background_image.read_bytes())

    if isinstance(background_image, (bytes, bytearray)):
        return _encode_bytes_to_data_url(bytes(background_image))

    try:
        from PIL.Image import Image as PILImageType
    except ImportError:
        raise TypeError(
            "background_image must be a URL string, a file path, bytes, or a "
            "PIL.Image.Image (a PIL image requires the 'image' extra: "
            f"pip install streamlit-drawable-canvas[image]), got "
            f"{type(background_image).__name__}"
        ) from None

    if not isinstance(background_image, PILImageType):
        raise TypeError(
            "background_image must be a URL string, a file path, bytes, or a "
            f"PIL.Image.Image, got {type(background_image).__name__}"
        )

    buf = io.BytesIO()
    background_image.convert("RGBA").save(buf, format="PNG")
    return _encode_bytes_to_data_url(buf.getvalue())


def st_canvas(
    fill_color: str = "#eee",
    stroke_width: int = 20,
    stroke_color: str = "black",
    background_color: str = "",
    background_image: str | Path | bytes | PILImage | None = None,
    update_streamlit: bool = True,
    height: int = 400,
    width: int = 600,
    drawing_mode: str = "freedraw",
    initial_drawing: dict | None = None,
    display_toolbar: bool = True,
    point_display_radius: int = 3,
    return_image_data: bool = False,
    key: str | None = None,
    on_change: Callable[[], None] | None = None,
    disabled: bool = False,
    background_image_fit: str = "stretch",
) -> CanvasResult:
    """Create a drawing canvas in a Streamlit app.

    Parameters
    ----------
    fill_color: str
        Color of fill for Rect/Circle/Polygon in CSS color property. Defaults
        to "#eee".
    stroke_width: int
        Width of drawing brush in CSS color property. Defaults to 20.
    stroke_color: str
        Color of drawing brush in hex. Defaults to "black".
    background_color: str
        Color of canvas background in CSS color property. Defaults to "",
        which is transparent. Overridden by background_image. Note: changing
        background_color resets the drawing.
    background_image: str | Path | bytes | PIL.Image.Image
        Image to display behind the canvas: an http(s) URL, a data: URI, a
        local file path, raw image bytes, or a PIL Image. Scaled to canvas
        dimensions. Being behind the canvas, it is not sent back to
        Streamlit on mouse event.
    update_streamlit: bool
        Whenever True, send canvas data to Streamlit when an object or
        selection is updated, or on mouse up. Ignored when
        drawing_mode="polygon": a polygon is only ever sent once closed with
        a right-click, regardless of this flag.
    height: int
        Height of canvas in pixels. Defaults to 400.
    width: int
        Width of canvas in pixels. Defaults to 600.
    drawing_mode: {'freedraw', 'transform', 'line', 'rect', 'circle', 'point', 'polygon'}
        Enable free drawing when "freedraw", object manipulation when
        "transform", or shape drawing for the rest. Defaults to "freedraw".
    initial_drawing: dict
        Redraw canvas with the given initial_drawing. If changed to None,
        empties the canvas. Should generally be the `json_data` output from
        another canvas, which you can manipulate. Beware: if importing from a
        bigger/smaller canvas, no rescaling is done in the canvas -- do it on
        your side.
    display_toolbar: bool
        Display the undo/redo/reset toolbar. It appears on hover as a floating
        card above the canvas's top-right corner, like Streamlit's own element
        toolbars, and takes up no layout space.
    point_display_radius: int
        The radius to use when displaying point objects. Defaults to 3.
    return_image_data: bool
        Whenever True, populate `image_data` on the result with the canvas's
        RGBA pixels. Off by default -- it PNG-encodes the whole canvas on
        every send, which is wasted work for callers who only read
        `json_data`. Requires the `image` extra:
        `pip install streamlit-drawable-canvas[image]`.
    key: str
        An optional string to use as the unique key for the widget. Assign a
        key so the component is not remounted every time the script reruns.
    on_change: callable
        Optional callback invoked when the component sends a new drawing.
    disabled: bool
        Render the canvas read-only: drawing, selection and transforms are
        all inert, and the toolbar is hidden regardless of `display_toolbar`
        (undo, redo and reset would otherwise let a viewer mutate a canvas
        that is supposed to be read-only). `initial_drawing` still renders,
        so this is the way to display a drawing back to someone without
        letting them change it. Defaults to False.
    background_image_fit: {'stretch', 'contain'}
        How `background_image` is scaled onto the canvas. "stretch" (the
        default, and the historical behaviour) scales each axis
        independently to fill the canvas exactly, distorting the image if
        its aspect ratio differs. "contain" preserves the aspect ratio,
        scaling the image to fit inside the canvas and centring it, so a
        canvas larger than the image gets margins instead of a stretched
        image. Ignored when no `background_image` is set.

    Returns
    -------
    result: CanvasResult
        `image_data` contains the reshaped RGBA image 4D numpy array (r, g,
        b, alpha) -- only if `return_image_data=True`, otherwise accessing it
        raises. `json_data` stores the canvas/objects JSON representation,
        which you can manipulate, store, and reinject into another canvas
        through the `initial_drawing` argument.
    """
    if drawing_mode not in _VALID_DRAWING_MODES:
        raise ValueError(
            f"drawing_mode must be one of {sorted(_VALID_DRAWING_MODES)}, "
            f"got {drawing_mode!r}"
        )

    if background_image_fit not in _VALID_BACKGROUND_IMAGE_FITS:
        raise ValueError(
            "background_image_fit must be one of "
            f"{sorted(_VALID_BACKGROUND_IMAGE_FITS)}, got {background_image_fit!r}"
        )

    background_image_url = _resolve_background_image_url(background_image)
    if background_image_url is not None:
        # An image takes precedence over a flat background color.
        background_color = ""

    base_drawing: dict[str, Any] = (
        {"objects": []} if initial_drawing is None else dict(initial_drawing)
    )
    base_drawing["background"] = background_color

    data = {
        "fillColor": fill_color,
        "strokeWidth": stroke_width,
        "strokeColor": stroke_color,
        "backgroundColor": background_color,
        "backgroundImageURL": background_image_url,
        "realtimeUpdateStreamlit": update_streamlit and (drawing_mode != "polygon"),
        "canvasWidth": width,
        "canvasHeight": height,
        "drawingMode": drawing_mode,
        "initialDrawing": base_drawing,
        "displayToolbar": display_toolbar,
        "displayRadius": point_display_radius,
        "returnImageData": return_image_data,
        "disabled": disabled,
        "backgroundImageFit": background_image_fit,
    }

    result = out(
        data=data,
        key=key,
        default={"drawing": {"raw": base_drawing, "data": None}},
        on_drawing_change=on_change or (lambda: None),
        width="content",
        height="content",
    )

    drawing = result.get("drawing") or {"raw": base_drawing, "data": None}
    return CanvasResult(
        json_data=drawing.get("raw"),
        image_data_url=drawing.get("data"),
        return_image_data=return_image_data,
    )
