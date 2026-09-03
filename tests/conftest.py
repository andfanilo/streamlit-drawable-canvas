from unittest.mock import MagicMock, patch


def pytest_configure(config):
    """Patch st.components.v2.component before streamlit_drawable_canvas is imported.

    The module-level call in __init__.py needs an active Streamlit runtime to
    resolve its component manifest, so a bare import outside `streamlit run`
    raises. Mocking it lets pytest reach CanvasResult and the background-image
    helpers without a server or a built frontend/.
    """
    patcher = patch(
        "streamlit.components.v2.component",
        return_value=MagicMock(),
    )
    patcher.start()
    config._st_component_patcher = patcher


def pytest_unconfigure(config):
    patcher = getattr(config, "_st_component_patcher", None)
    if patcher is not None:
        patcher.stop()
