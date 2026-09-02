# streamlit-drawable-canvas — task runner
# Usage: `just <recipe>`  |  list recipes: `just --list`

set windows-shell := ["pwsh.exe", "-NoLogo", "-Command"]

frontend := "streamlit_drawable_canvas/frontend"
demo_app := "e2e/app_to_test.py"

# react-scripts 4 uses a hash OpenSSL 3 (Node >= 17) rejects; CI pins Node 16 instead
export NODE_OPTIONS := "--openssl-legacy-provider"

# Default: show available recipes
default:
    @just --list

# --- Development setup ---

# Full local setup (Python venv + editable install + frontend deps)
setup: setup-py setup-frontend

# Create .venv and install the package in editable mode
setup-py:
    uv venv
    uv pip install -e .

# Install frontend deps from the lockfile
setup-frontend:
    cd {{frontend}} && npm ci --legacy-peer-deps

# Wipe everything and reinstall from scratch
reinstall: clean setup

# --- Run ---

# Serve the component from frontend/build (run `just build` first, needs _RELEASE = True)
run:
    uv run streamlit run {{demo_app}}

# Frontend dev server on :3001 — run alongside `just run` (flips _RELEASE to False first)
dev: dev-mode
    cd {{frontend}} && npm run start

# Point the component at the :3001 dev server
dev-mode:
    @(Get-Content streamlit_drawable_canvas/__init__.py -Raw) -replace '(?m)^_RELEASE = [^\r\n]*', '_RELEASE = False  # on packaging, pass this to True' | Set-Content streamlit_drawable_canvas/__init__.py -NoNewline

# Point the component back at frontend/build (do this before building/publishing)
release-mode:
    @(Get-Content streamlit_drawable_canvas/__init__.py -Raw) -replace '(?m)^_RELEASE = [^\r\n]*', '_RELEASE = True  # on packaging, pass this to True' | Set-Content streamlit_drawable_canvas/__init__.py -NoNewline

# --- Lint & format ---

format-frontend:
    cd {{frontend}} && npx prettier --write "src/**/*.{ts,tsx,css}"

lint-frontend:
    cd {{frontend}} && npx prettier --check "src/**/*.{ts,tsx,css}"

# --- Testing ---

# Frontend unit tests (react-scripts / jest, watch mode by default)
test-frontend:
    cd {{frontend}} && npm test

# Install Cypress (one-time)
e2e-setup:
    cd e2e && npm i

# Open the Cypress UI — needs `just run` (or `just dev`) serving on :8501
e2e-open:
    cd e2e && npm run cypress:open

# Run Cypress headless — needs `just run` (or `just dev`) serving on :8501
e2e:
    cd e2e && npm run cypress:run

# --- Build & publish ---

# Build frontend assets + sdist/wheel into dist/
build: release-mode build-frontend build-wheel

build-frontend:
    cd {{frontend}} && npm run build

# Build sdist + wheel into dist/
build-wheel:
    @# stale egg-info is removed because setuptools re-reads SOURCES.txt from it,
    @# and would re-include files no longer matched by the packaging config
    -Remove-Item -Recurse -Force dist, build, *.egg-info -ErrorAction Ignore
    uv build

# Remove build outputs + installed deps
clean:
    -Remove-Item -Recurse -Force dist, build, *.egg-info, .venv -ErrorAction Ignore
    -Remove-Item -Recurse -Force {{frontend}}/node_modules, {{frontend}}/build -ErrorAction Ignore
    -Remove-Item -Recurse -Force e2e/node_modules -ErrorAction Ignore

# Publish to PyPI (set UV_PUBLISH_TOKEN or pass --token); CI does this on release
publish: build
    uv publish
