"""
Global pytest fixtures for streamlit-drawable-canvas E2E tests.
Adapted from ../streamlit-echarts/e2e_playwright/conftest.py, which itself
descends from the streamlit-bokeh conftest.py pattern.
"""

from __future__ import annotations

import hashlib
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
from collections.abc import Generator
from io import BytesIO
from pathlib import Path
from random import randint
from tempfile import TemporaryFile
from typing import Any, Literal, Protocol

import pytest
import requests
from PIL import Image
from playwright.sync_api import ElementHandle, FrameLocator, Locator, Page
from pytest import FixtureRequest
from shared.git_utils import get_git_root


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


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return []


@pytest.fixture(scope="module", autouse=True)
def app_server(
    app_port: int,
    app_server_extra_args: list[str],
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
            *app_server_extra_args,
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


@pytest.fixture(scope="function", params=["light_theme", "dark_theme"])
def app_theme(request) -> str:
    return str(request.param)


@pytest.fixture(scope="function")
def themed_app(page: Page, app_port: int, app_theme: str) -> Page:
    page.goto(f"http://localhost:{app_port}/?embed_options={app_theme}")
    wait_for_app_loaded(page)
    return page


class ImageCompareFunction(Protocol):
    def __call__(
        self,
        element: ElementHandle | Locator | Page,
        *,
        image_threshold: float = 0.002,
        pixel_threshold: float = 0.05,
        name: str | None = None,
        fail_fast: bool = False,
    ) -> None: ...


@pytest.fixture(scope="session", autouse=True)
def delete_output_dir(pytestconfig: Any) -> None:
    output_dir = pytestconfig.getoption("--output")
    if os.path.exists(output_dir):
        try:
            shutil.rmtree(output_dir)
        except (FileNotFoundError, OSError):
            pass


@pytest.fixture(scope="session")
def output_folder(pytestconfig: Any) -> Path:
    return Path(
        get_git_root() / "e2e_playwright" / pytestconfig.getoption("--output")
    ).resolve()


@pytest.fixture(scope="function")
def assert_snapshot(
    request: FixtureRequest, output_folder: Path
) -> Generator[ImageCompareFunction, None, None]:
    root_path = get_git_root()
    platform = str(sys.platform)
    module_name = request.module.__name__.split(".")[-1]
    test_function_name = request.node.originalname

    snapshot_dir = (
        root_path / "e2e_playwright" / "__snapshots__" / platform / module_name
    )
    snapshot_failures_dir = (
        output_folder / "snapshot-tests-failures" / platform / module_name
    )
    snapshot_updates_dir = output_folder / "snapshot-updates" / platform / module_name

    suffix = ""
    match = re.search(r"\[(.*?)\]", request.node.name)
    if match:
        suffix = f"[{match.group(1)}]"

    default_name = test_function_name + suffix
    failure_messages: list[str] = []

    def compare(
        element: ElementHandle | Locator | Page,
        *,
        image_threshold: float = 0.002,
        pixel_threshold: float = 0.05,
        name: str | None = None,
        fail_fast: bool = False,
        file_type: Literal["png", "jpg"] = "png",
    ) -> None:
        file_ext = ".jpg" if file_type == "jpg" else ".png"
        img_bytes = (
            element.screenshot(type="jpeg", quality=90, animations="disabled")
            if file_type == "jpg"
            else element.screenshot(type="png", animations="disabled")
        )
        snapshot_name = name + suffix if name else default_name
        snapshot_path = snapshot_dir / f"{snapshot_name}{file_ext}"
        updates_path = snapshot_updates_dir / f"{snapshot_name}{file_ext}"
        failures_dir = snapshot_failures_dir / snapshot_name

        snapshot_path.parent.mkdir(parents=True, exist_ok=True)

        if failures_dir.exists():
            shutil.rmtree(failures_dir)

        if not snapshot_path.exists():
            snapshot_path.write_bytes(img_bytes)
            updates_path.parent.mkdir(parents=True, exist_ok=True)
            updates_path.write_bytes(img_bytes)
            failure_messages.append(f"Missing snapshot for {snapshot_name}")
            return

        from pixelmatch.contrib.PIL import pixelmatch

        img_a = Image.open(BytesIO(img_bytes))
        img_b = Image.open(snapshot_path)
        img_diff = Image.new("RGBA", img_a.size)
        try:
            mismatch = pixelmatch(
                img_a,
                img_b,
                img_diff,
                threshold=pixel_threshold,
                fail_fast=fail_fast,
                alpha=0,
            )
        except ValueError as ex:
            updates_path.parent.mkdir(parents=True, exist_ok=True)
            updates_path.write_bytes(img_bytes)
            failure_messages.append(
                f"Size mismatch for {snapshot_name}: expected {img_b.size}, got {img_a.size}. {ex}"
            )
            return

        total_pixels = img_a.size[0] * img_a.size[1]
        if mismatch < int(image_threshold * total_pixels):
            return

        updates_path.parent.mkdir(parents=True, exist_ok=True)
        updates_path.write_bytes(img_bytes)
        failures_dir.mkdir(parents=True, exist_ok=True)
        img_diff.save(f"{failures_dir}/diff_{snapshot_name}{file_ext}")
        img_a.save(f"{failures_dir}/actual_{snapshot_name}{file_ext}")
        img_b.save(f"{failures_dir}/expected_{snapshot_name}{file_ext}")
        failure_messages.append(
            f"Snapshot mismatch for {snapshot_name} ({mismatch} pixels; "
            f"{mismatch / total_pixels * 100:.2f}%)"
        )

    yield compare

    if failure_messages:
        pytest.fail("Missing or mismatched snapshots:\n" + "\n".join(failure_messages))


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
