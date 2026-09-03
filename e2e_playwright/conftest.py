"""Global pytest fixtures for streamlit-drawable-canvas E2E tests."""

from __future__ import annotations

import hashlib
import json
import os
import shlex
import socket
import subprocess
import time
from collections.abc import Generator
from random import randint
from tempfile import TemporaryFile

import pytest
import requests
from playwright.sync_api import FrameLocator, Locator, Page
from pytest import FixtureRequest


class AsyncSubprocess:
    """Context manager that wraps subprocess.Popen to capture output safely."""

    def __init__(self, args, cwd=None, env=None):
        self.args = args
        self.cwd = cwd
        self.env = env or {}
        self._proc = None
        self._stdout_file = None

    def terminate(self):
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

    def __enter__(self):
        self.start()
        return self

    def start(self):
        self._stdout_file = TemporaryFile("w+")  # noqa: SIM115 -- closed in terminate(), not start()
        print(f"Running: {shlex.join(self.args)}")
        self._proc = subprocess.Popen(
            self.args,
            cwd=self.cwd,
            stdout=self._stdout_file,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ.copy(), **self.env},
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._proc is not None:
            self._proc.terminate()
            self._proc = None
        if self._stdout_file is not None:
            self._stdout_file.close()
            self._stdout_file = None


def resolve_test_to_script(test_module) -> str:
    """Resolve the test module to the corresponding Streamlit app script."""
    assert test_module.__file__ is not None
    return test_module.__file__.replace("_test.py", ".py")


def hash_to_range(text: str, min: int = 10000, max: int = 65535) -> int:
    sha256_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return min + (int(sha256_hash, 16) % (max - min + 1))


def is_port_available(port: int, host: str) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) != 0


def find_available_port(
    min_port: int = 10000,
    max_port: int = 65535,
    max_tries: int = 50,
    host: str = "localhost",
) -> int:
    for _ in range(max_tries):
        port = randint(min_port, max_port)
        if is_port_available(port, host):
            return port
    raise RuntimeError("Unable to find an available port.")


def is_app_server_running(port: int, host: str = "localhost") -> bool:
    try:
        return (
            requests.get(f"http://{host}:{port}/_stcore/health", timeout=1).text == "ok"
        )
    except Exception:  # noqa: BLE001 -- any failure means "not ready yet", not ready to classify
        return False


def wait_for_app_server_to_start(port: int, timeout: int = 5) -> bool:
    print(f"Waiting for app to start on port {port}...")
    start_time = time.time()
    while not is_app_server_running(port):
        time.sleep(3)
        if time.time() - start_time > 60 * timeout:
            return False
    return True


@pytest.fixture(scope="module")
def app_port(worker_id: str) -> int:
    if worker_id and worker_id != "master":
        port = hash_to_range(worker_id)
        if is_port_available(port, "localhost"):
            return port
    return find_available_port()


@pytest.fixture(scope="module", autouse=True)
def app_server(
    app_port: int,
    request: FixtureRequest,
) -> Generator[AsyncSubprocess, None, None]:
    """Start the Streamlit app server for the test module."""
    streamlit_proc = AsyncSubprocess(
        [
            "streamlit",
            "run",
            resolve_test_to_script(request.module),
            "--server.headless",
            "true",
            "--global.developmentMode",
            "false",
            "--global.e2eTest",
            "true",
            "--server.port",
            str(app_port),
            "--browser.gatherUsageStats",
            "false",
            "--server.fileWatcherType",
            "none",
            "--server.enableStaticServing",
            "true",
        ],
        cwd=".",
    )
    streamlit_proc.start()
    if not wait_for_app_server_to_start(app_port):
        stdout = streamlit_proc.terminate()
        print(stdout, flush=True)
        raise RuntimeError("Unable to start Streamlit app")
    yield streamlit_proc
    print(streamlit_proc.terminate(), flush=True)


@pytest.fixture(scope="function")
def app(page: Page, app_port: int) -> Page:
    """Open the app and wait for it to load."""
    page.goto(f"http://localhost:{app_port}/")
    wait_for_app_loaded(page)
    return page


COMPONENT = "[data-testid=stBidiComponentIsolated]"


def component(app: Page, index: int = 0) -> Locator:
    """The nth canvas component's isolated root element."""
    return app.locator(COMPONENT).nth(index)


def canvas(app: Page, index: int = 0) -> Locator:
    """The nth canvas's Fabric interaction surface, scrolled into view."""
    el = component(app, index).locator("canvas.upper-canvas")
    el.scroll_into_view_if_needed()
    return el


def read_json(app: Page, index: int = 0) -> dict | None:
    """Parse the nth `st.code` block; every test app uses one for readback."""
    return json.loads(app.locator("[data-testid=stCode]").nth(index).inner_text())


def drag(
    app: Page,
    target: Locator,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    steps: int = 5,
    button: str = "left",
) -> None:
    """Drag across `target`, in its own top-left-origin coordinates.

    Raw `page.mouse.*` events don't auto-scroll the way `Locator.click()` does,
    so a below-the-fold canvas needs the explicit scroll first.
    """
    target.scroll_into_view_if_needed()
    box = target.bounding_box()
    assert box is not None
    sx, sy = box["x"] + x0, box["y"] + y0
    ex, ey = box["x"] + x1, box["y"] + y1
    app.mouse.move(sx, sy)
    app.mouse.down(button=button)
    for i in range(1, steps + 1):
        app.mouse.move(sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps)
    app.mouse.up(button=button)


def click(app: Page, target: Locator, x: float, y: float, button: str = "left") -> None:
    drag(app, target, x, y, x, y, steps=1, button=button)


def wait_for_app_run(
    page_or_locator: Page | Locator | FrameLocator, wait_delay: int = 5000
):
    if isinstance(page_or_locator, Page):
        page = page_or_locator
    elif isinstance(page_or_locator, Locator):
        page = page_or_locator.page
    else:
        page = page_or_locator.owner.page

    page.wait_for_timeout(155)
    page_or_locator.locator(
        "[data-testid='stApp'][data-test-connection-state='CONNECTED']"
    ).wait_for(timeout=25000, state="attached")
    page_or_locator.locator(
        "[data-testid='stApp'][data-test-script-state='notRunning']"
    ).wait_for(timeout=25000, state="attached")
    if wait_delay > 0:
        page.wait_for_timeout(wait_delay)


def wait_for_app_loaded(page: Page, embedded: bool = False):
    page.wait_for_selector(
        "[data-testid='stAppViewContainer']", timeout=30000, state="attached"
    )
    if not embedded:
        page.wait_for_selector(
            "[data-testid='stMainMenu']", timeout=20000, state="attached"
        )
    wait_for_app_run(page)
