# Unlike ../streamlit-echarts, no fixture is needed here yet: v1's
# components.v1.declare_component(path=...) doesn't validate that the path
# exists at import time, so streamlit_drawable_canvas imports cleanly even
# without a built frontend/. Stage 2 moves to st.components.v2.component,
# which does require patching before import -- see streamlit-echarts/tests/conftest.py.
