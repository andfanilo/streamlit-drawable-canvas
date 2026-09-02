from unittest.mock import MagicMock, patch


def pytest_configure(config):
    """Patch st.components.v2.component before streamlit_drawable_canvas is imported.

    The module-level call in __init__.py requires an active Streamlit runtime
    to resolve its own component manifest (asset_dir, etc.) -- it works when a
    script actually runs under `streamlit run`, but a bare `import
    streamlit_drawable_canvas` outside that context raises. Mocking it lets us
    unit-test CanvasResult and the background-image helpers without a running
    server or a built frontend/. Mirrors ../streamlit-echarts/tests/conftest.py.
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
