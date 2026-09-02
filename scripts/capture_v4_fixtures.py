"""One-time capture of Fabric 4 JSON ground-truth fixtures.

Drives e2e_playwright/fixtures/capture_app.py (running against the *current*,
working Fabric 4.4.0 frontend built in stage 1 Phase A) with synthetic
Playwright mouse events, and writes each canvas's resulting json_data plus a
screenshot to e2e_playwright/fixtures/fabric-v4/.

Run with the frontend already built (`just build` or `just build-frontend`
+ _RELEASE = True) and Node 16 active for anything that rebuilds it:

    uv run python scripts/capture_v4_fixtures.py

This script will NOT run after stage 2 deletes the Fabric 4 frontend -- it is
kept only as a record of how the fixtures were produced. See
e2e_playwright/fixtures/fabric-v4/README.md.
"""

from __future__ import annotations

import json
import shlex
import socket
import subprocess
import sys
import time
from pathlib import Path
from random import randint
from tempfile import TemporaryFile

import requests
from playwright.sync_api import FrameLocator, Page, sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_SCRIPT = REPO_ROOT / "e2e_playwright" / "fixtures" / "capture_app.py"
OUTPUT_DIR = REPO_ROOT / "e2e_playwright" / "fixtures" / "fabric-v4"


class AsyncSubprocess:
    """Minimal subprocess wrapper that captures output, adapted from
    ../streamlit-echarts/e2e_playwright/conftest.py."""

    def __init__(self, args: list[str], cwd: str | None = None):
        self.args = args
        self.cwd = cwd
        self._proc: subprocess.Popen | None = None
        self._stdout_file = None

    def start(self) -> None:
        self._stdout_file = TemporaryFile("w+")  # noqa: SIM115 -- closed in terminate(), not start()
        print(f"Running: {shlex.join(self.args)}")
        self._proc = subprocess.Popen(
            self.args,
            cwd=self.cwd,
            stdout=self._stdout_file,
            stderr=subprocess.STDOUT,
            text=True,
        )

    def terminate(self) -> str | None:
        if self._proc is not None:
            self._proc.terminate()
            self._proc.wait()
            self._proc = None
        stdout = None
        if self._stdout_file is not None:
            self._stdout_file.seek(0)
            stdout = self._stdout_file.read()
            self._stdout_file.close()
            self._stdout_file = None
        return stdout


def find_available_port(min_port: int = 20000, max_port: int = 29999) -> int:
    for _ in range(50):
        port = randint(min_port, max_port)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(("localhost", port)) != 0:
                return port
    raise RuntimeError("Unable to find an available port.")


def wait_for_app_server(port: int, timeout_s: int = 60) -> bool:
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            if (
                requests.get(f"http://localhost:{port}/_stcore/health", timeout=1).text
                == "ok"
            ):
                return True
        except Exception:  # noqa: BLE001, S110 -- any failure means "not ready yet"
            pass
        time.sleep(1)
    return False


def wait_for_app_run(page: Page, wait_ms: int = 600) -> None:
    page.locator(
        "[data-testid='stApp'][data-test-connection-state='CONNECTED']"
    ).wait_for(timeout=25000, state="attached")
    page.locator("[data-testid='stApp'][data-test-script-state='notRunning']").wait_for(
        timeout=25000, state="attached"
    )
    page.wait_for_timeout(wait_ms)


def canvas_frame(page: Page, index: int) -> FrameLocator:
    """The nth st_canvas iframe, in top-to-bottom app order."""
    return page.frame_locator('iframe[data-testid="stCustomComponentV1"]').nth(index)


def interactive_canvas(frame: FrameLocator):
    """Fabric's upper-canvas -- the element that actually receives mouse events."""
    return frame.locator("#canvas").locator("xpath=..").locator("canvas.upper-canvas")


def canvas_bbox(canvas) -> dict:
    """Scroll the canvas into view, then return its page-viewport bounding box.

    page.mouse.* dispatches raw events at absolute viewport coordinates and,
    unlike Locator.click(), does NOT auto-scroll -- a canvas below the fold
    silently receives no events. Locator.scroll_into_view_if_needed() works
    across the frame boundary.
    """
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    assert box is not None
    return box


def read_json_data(page: Page, index: int) -> dict:
    """Scrape the st.code(json.dumps(...)) readback below the nth canvas."""
    text = page.locator('[data-testid="stCode"] pre').nth(index).inner_text()
    return json.loads(text)


def save_fixture(name: str, data: dict, png_bytes: bytes) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / f"{name}.json").write_text(json.dumps(data, indent=2) + "\n")
    (OUTPUT_DIR / f"{name}.v4-reference.png").write_bytes(png_bytes)
    print(
        f"  wrote {name}.json ({len(json.dumps(data))} bytes) + {name}.v4-reference.png"
    )


def screenshot_canvas(frame: FrameLocator) -> bytes:
    return frame.locator("#canvas").locator("xpath=..").screenshot()


def select_streamlit_option(page: Page, selectbox_index: int, option_text: str) -> None:
    """Drive a st.selectbox by index (top-to-bottom order among selectboxes)."""
    selectbox = page.locator('[data-testid="stSelectbox"]').nth(selectbox_index)
    selectbox.click()
    page.get_by_role("option", name=option_text, exact=True).click()
    wait_for_app_run(page)


def capture_freedraw(page: Page) -> None:
    print("freedraw")
    frame = canvas_frame(page, 0)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    points = [(20, 20), (80, 60), (140, 20), (200, 80), (260, 40)]
    page.mouse.move(x0 + points[0][0], y0 + points[0][1])
    page.mouse.down()
    for px, py in points[1:]:
        page.mouse.move(x0 + px, y0 + py, steps=5)
    page.mouse.up()
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 0)
    save_fixture("freedraw", data, png)


def capture_line(page: Page) -> None:
    print("line")
    frame = canvas_frame(page, 1)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 20, y0 + 20)
    page.mouse.down()
    page.mouse.move(x0 + 250, y0 + 160, steps=10)
    page.mouse.up()
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 1)
    save_fixture("line", data, png)


def capture_rect(page: Page) -> None:
    print("rect")
    frame = canvas_frame(page, 2)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 30, y0 + 30)
    page.mouse.down()
    page.mouse.move(x0 + 220, y0 + 150, steps=10)
    page.mouse.up()
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 2)
    save_fixture("rect", data, png)


def capture_circle(page: Page) -> None:
    print("circle")
    frame = canvas_frame(page, 3)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 50, y0 + 40)
    page.mouse.down()
    page.mouse.move(x0 + 180, y0 + 150, steps=10)
    page.mouse.up()
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 3)
    save_fixture("circle", data, png)


def capture_point(page: Page) -> None:
    print("point")
    frame = canvas_frame(page, 4)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 150, y0 + 100)
    page.mouse.down()
    page.mouse.up()
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 4)
    save_fixture("point", data, png)


def capture_polygon(page: Page) -> None:
    print("polygon")
    frame = canvas_frame(page, 5)
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    vertices = [(50, 30), (250, 30), (250, 170), (50, 170)]
    for vx, vy in vertices:
        page.mouse.click(x0 + vx, y0 + vy)
        page.wait_for_timeout(100)
    # Right-click closes the polygon (see lib/polygon.ts) and forces the
    # component to sync state to Streamlit regardless of update_streamlit
    # (see DrawableCanvas.tsx's mouse:up handler, e.button === 3 branch).
    page.mouse.click(x0 + vertices[0][0], y0 + vertices[0][1], button="right")
    wait_for_app_run(page)
    png = screenshot_canvas(frame)
    data = read_json_data(page, 5)
    save_fixture("polygon", data, png)


def capture_transform(page: Page) -> None:
    print("transform")
    frame = canvas_frame(page, 6)

    # Step 1: draw a rect while transform_mode selectbox = "rect" (its default).
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 40, y0 + 40)
    page.mouse.down()
    page.mouse.move(x0 + 160, y0 + 120, steps=10)
    page.mouse.up()
    wait_for_app_run(page)

    # Step 2: switch to transform mode (selectbox index 0 -- the first/only
    # selectbox on the page at this point).
    select_streamlit_option(page, 0, "transform")

    # Re-resolve: switching drawing_mode re-renders the component but keeps
    # the same key, so the iframe/canvas identity is stable; re-query anyway
    # for a fresh bounding box.
    canvas = interactive_canvas(frame)
    box = canvas_bbox(canvas)
    x0, y0 = box["x"], box["y"]

    # Step 3: move the rect (drag its body/center).
    page.mouse.move(x0 + 100, y0 + 80)
    page.mouse.down()
    page.mouse.move(x0 + 150, y0 + 110, steps=10)
    page.mouse.up()
    wait_for_app_run(page)

    # Step 4: scale via the bottom-right corner handle (now at the rect's new
    # bottom-right corner: left=90,top=70,width=120,height=80 -> (210,150)).
    page.mouse.move(x0 + 210, y0 + 150)
    page.mouse.down()
    page.mouse.move(x0 + 260, y0 + 190, steps=10)
    page.mouse.up()
    wait_for_app_run(page)

    # Step 5: rotate via the rotation handle (top-center, rotatingPointOffset
    # =40px above the top edge; top-left corner is fixed by the br-corner
    # scale above, so top-center is now at left=90,top=70,width*scaleX~170
    # -> (175, 30)).
    page.mouse.move(x0 + 175, y0 + 30)
    page.mouse.down()
    page.mouse.move(x0 + 230, y0 + 10, steps=10)
    page.mouse.up()
    wait_for_app_run(page)

    # Deselect (click empty canvas) so the reference PNG shows the plain
    # shape, not Fabric's selection handles -- a freshly loadFromJSON'd
    # object in stage 2 won't be selected either.
    page.mouse.click(x0 + 10, y0 + 190)
    wait_for_app_run(page)

    png = screenshot_canvas(frame)
    data = read_json_data(page, 6)
    save_fixture("transform", data, png)


def capture_kitchen_sink(page: Page) -> None:
    print("kitchen-sink")
    frame = canvas_frame(page, 7)

    def canvas_box():
        canvas = interactive_canvas(frame)
        box = canvas_bbox(canvas)
        return box["x"], box["y"]

    # selectbox index 1: transform's selectbox is index 0, kitchen-sink's is
    # index 1 (declared after it in capture_app.py).
    SB = 1

    # rect (selectbox already defaults to "rect")
    x0, y0 = canvas_box()
    page.mouse.move(x0 + 20, y0 + 20)
    page.mouse.down()
    page.mouse.move(x0 + 90, y0 + 80, steps=8)
    page.mouse.up()
    wait_for_app_run(page)

    # circle
    select_streamlit_option(page, SB, "circle")
    x0, y0 = canvas_box()
    page.mouse.move(x0 + 110, y0 + 20)
    page.mouse.down()
    page.mouse.move(x0 + 180, y0 + 80, steps=8)
    page.mouse.up()
    wait_for_app_run(page)

    # line
    select_streamlit_option(page, SB, "line")
    x0, y0 = canvas_box()
    page.mouse.move(x0 + 200, y0 + 20)
    page.mouse.down()
    page.mouse.move(x0 + 280, y0 + 80, steps=8)
    page.mouse.up()
    wait_for_app_run(page)

    # freedraw
    select_streamlit_option(page, SB, "freedraw")
    x0, y0 = canvas_box()
    fd_points = [(20, 110), (60, 140), (100, 110), (140, 140)]
    page.mouse.move(x0 + fd_points[0][0], y0 + fd_points[0][1])
    page.mouse.down()
    for px, py in fd_points[1:]:
        page.mouse.move(x0 + px, y0 + py, steps=5)
    page.mouse.up()
    wait_for_app_run(page)

    # point
    select_streamlit_option(page, SB, "point")
    x0, y0 = canvas_box()
    page.mouse.move(x0 + 170, y0 + 120)
    page.mouse.down()
    page.mouse.up()
    wait_for_app_run(page)

    # transform: nudge the rect (first object added) so the fixture also
    # exercises angle/scaleX/scaleY alongside the other shape types.
    select_streamlit_option(page, SB, "transform")
    x0, y0 = canvas_box()
    page.mouse.move(x0 + 55, y0 + 50)
    page.mouse.down()
    page.mouse.move(x0 + 65, y0 + 60, steps=5)
    page.mouse.up()
    wait_for_app_run(page)

    # Deselect (click empty canvas) so the reference PNG shows the plain
    # shapes, not Fabric's selection handles on the last-manipulated object.
    page.mouse.click(x0 + 280, y0 + 180)
    wait_for_app_run(page)

    png = screenshot_canvas(frame)
    data = read_json_data(page, 7)
    save_fixture("kitchen-sink", data, png)


def main() -> None:
    port = find_available_port()
    proc = AsyncSubprocess(
        [
            sys.executable,
            "-m",
            "streamlit",
            "run",
            str(APP_SCRIPT),
            "--server.headless",
            "true",
            "--server.port",
            str(port),
            "--browser.gatherUsageStats",
            "false",
            "--server.fileWatcherType",
            "none",
        ],
        cwd=str(REPO_ROOT),
    )
    proc.start()
    try:
        if not wait_for_app_server(port):
            print(proc.terminate())
            raise RuntimeError("Streamlit app did not start in time")

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 2400})
            page.goto(f"http://localhost:{port}/")
            wait_for_app_run(page, wait_ms=1500)

            capture_freedraw(page)
            capture_line(page)
            capture_rect(page)
            capture_circle(page)
            capture_point(page)
            capture_polygon(page)
            capture_transform(page)
            capture_kitchen_sink(page)

            browser.close()
    finally:
        stdout = proc.terminate()
        if stdout:
            print("--- streamlit log ---")
            print(stdout)


if __name__ == "__main__":
    main()
