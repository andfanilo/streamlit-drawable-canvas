"""Git utility functions for E2E tests."""

from __future__ import annotations

import subprocess
from pathlib import Path


def get_git_root() -> Path:
    """Get the root directory of the git repository."""
    try:
        return Path(
            subprocess.check_output(["git", "rev-parse", "--show-toplevel"])
            .strip()
            .decode("utf-8")
        )
    except subprocess.CalledProcessError:
        raise RuntimeError("Not a git repository or git is not installed.")
