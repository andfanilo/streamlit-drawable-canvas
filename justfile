# streamlit-drawable-canvas — task runner
# Usage: `just <recipe>`  |  list recipes: `just --list`

set windows-shell := ["pwsh.exe", "-NoLogo", "-Command"]

frontend := "streamlit_drawable_canvas/frontend"
demo_app := "e2e/app_to_test.py"

# Default: show available recipes
default:
    @just --list

# --- Development setup ---

# Full local dev setup (Python + frontend + git hook)
setup: setup-py setup-frontend
    uv run pre-commit install

# Install Python deps in editable mode
setup-py:
    uv sync

# Install frontend deps from the lockfile
# DELETE IN STAGE 2: --legacy-peer-deps only exists because react-scripts 4 / React 16
# pin peer deps that npm 7+ now enforces strictly; Vite 8 + Fabric 7 need no such override
setup-frontend:
    cd {{frontend}} && npm ci --legacy-peer-deps

# Wipe everything and reinstall from scratch
reinstall: clean setup

# --- Run ---

# Serve the component from frontend/build (run `just build` first, needs _RELEASE = True)
run:
    uv run streamlit run {{demo_app}}

# DELETE IN STAGE 2: v1's dev loop is a separate :3001 CRA dev server toggled via the
# _RELEASE flag. Stage 2 replaces this with Vite watch-rebuild (`npm run dev`, no
# separate server) run alongside `just run`, matching ../streamlit-echarts.
# Frontend dev server on :3001 — run alongside `just run` (flips _RELEASE to False first)
dev: dev-mode
    cd {{frontend}} && npm run start

# DELETE IN STAGE 2: goes with `dev` above — the _RELEASE toggle disappears once there is
# only one frontend build to point at.
# Point the component at the :3001 dev server
dev-mode:
    @(Get-Content streamlit_drawable_canvas/__init__.py -Raw) -replace '(?m)^_RELEASE = [^\r\n]*', '_RELEASE = False  # on packaging, pass this to True' | Set-Content streamlit_drawable_canvas/__init__.py -NoNewline

# DELETE IN STAGE 2: goes with `dev-mode` above.
# Point the component back at frontend/build (do this before building/publishing)
release-mode:
    @(Get-Content streamlit_drawable_canvas/__init__.py -Raw) -replace '(?m)^_RELEASE = [^\r\n]*', '_RELEASE = True  # on packaging, pass this to True' | Set-Content streamlit_drawable_canvas/__init__.py -NoNewline

# --- Lint & format ---

# Lint everything (Python + frontend)
lint: lint-py

lint-py:
    uv run ruff check --fix .

# STAGE 2: v1 frontend/src was never prettier-formatted; enable once it's rewritten.
lint-frontend:
    @echo "lint-frontend: deferred to stage 2"

# Format everything (Python + frontend)
format: format-py

format-py:
    uv run ruff format .

format-frontend:
    cd {{frontend}} && npx prettier --write "src/**/*.{ts,tsx,css}"

# Run all pre-commit hooks
pre-commit:
    uv run pre-commit run --all-files

# --- Testing ---

# Run all unit tests (Python + frontend)
test: test-py test-frontend

# Python unit tests
test-py:
    uv run pytest tests/ -v

# DELETE IN STAGE 2: becomes Vitest (`npm test` via vitest) once the frontend is rewritten.
# Frontend unit tests (react-scripts / jest, watch mode by default)
test-frontend:
    cd {{frontend}} && npm test

# --- E2E ---

# DELETE IN STAGE 2: e2e/ Cypress suite goes away, not ported to v2.
# Install Cypress (one-time)
cypress-setup:
    cd e2e && npm i

# DELETE IN STAGE 2 (T7). Needs `just run` (or `just dev`) serving on :8501.
cypress-open:
    cd e2e && npm run cypress:open

# DELETE IN STAGE 2 (T7). Needs `just run` (or `just dev`) serving on :8501.
cypress-run:
    cd e2e && npm run cypress:run

# Install Playwright deps + browsers (one-time)
e2e-setup:
    uv sync --group e2e
    uv run python -m playwright install --with-deps

# Run E2E tests
e2e:
    uv run pytest e2e_playwright -n auto

# Free ~500MB by uninstalling Playwright browser binaries
e2e-clean:
    uv run python -m playwright uninstall --all

# --- Build & publish ---

# DELETE IN STAGE 2: `release-mode` step goes away with the _RELEASE flag.
# Build frontend assets + Python wheel into dist/
build: release-mode build-frontend build-wheel

build-frontend:
    cd {{frontend}} && npm run build

# Stale egg-info is removed because setuptools re-reads SOURCES.txt and would
# re-include files no longer matched by the packaging config
build-wheel:
    -Remove-Item dist/*.whl, dist/*.tar.gz -Force -ErrorAction Ignore
    -Remove-Item -Recurse -Force *.egg-info -ErrorAction Ignore
    uv build

# Full from-scratch wheel: wipe deps + artifacts, reinstall (reconciles package.json + dedupes), rebuild
build-clean: clean setup-frontend build

# Remove build outputs + installed frontend deps (Windows/pwsh)
clean:
    -Remove-Item -Recurse -Force dist, build, *.egg-info -ErrorAction Ignore
    -Remove-Item -Recurse -Force {{frontend}}/node_modules, {{frontend}}/build -ErrorAction Ignore
    -Remove-Item -Recurse -Force e2e/node_modules -ErrorAction Ignore

# Publish to Test PyPI (reads token from UV_PUBLISH_TOKEN_TEST; real PyPI uses UV_PUBLISH_TOKEN)
publish-test: _verify-release-state build
    uv publish --index testpypi --token $env:UV_PUBLISH_TOKEN_TEST

# Publish to PyPI (set UV_PUBLISH_TOKEN or pass --token)
publish: _verify-release-state build
    uv publish

# --- Release ---

# Bump version on develop: sync every version field (root + inner pyproject, uv.lock, frontend package + lock), then commit
bump version:
    @if ((git rev-parse --abbrev-ref HEAD) -ne "develop") { Write-Host -ForegroundColor Red "Must be on develop to bump version"; exit 1 }
    @if (git status --porcelain) { Write-Host -ForegroundColor Red "Working tree not clean. Commit or stash first."; exit 1 }
    (Get-Content pyproject.toml -Raw) -replace '(?m)^version = "[^"]*"', 'version = "{{version}}"' | Set-Content pyproject.toml -NoNewline
    uv lock
    # STAGE 2: streamlit_drawable_canvas/pyproject.toml (the inner v2 manifest) doesn't
    # exist until stage 2. Sync its version too, once it does.
    @if (Test-Path streamlit_drawable_canvas/pyproject.toml) { (Get-Content streamlit_drawable_canvas/pyproject.toml -Raw) -replace '(?m)^version = "[^"]*"', 'version = "{{version}}"' | Set-Content streamlit_drawable_canvas/pyproject.toml -NoNewline }
    cd {{frontend}} && npm version {{version}} --no-git-tag-version --allow-same-version
    git add pyproject.toml uv.lock {{frontend}}/package.json {{frontend}}/package-lock.json
    @if (Test-Path streamlit_drawable_canvas/pyproject.toml) { git add streamlit_drawable_canvas/pyproject.toml }
    git commit -m "Bump version to {{version}}"

# Cut a release: ff-merge develop into main, annotated tag vX.Y.Z, push both
tag-release version:
    @if (git status --porcelain) { Write-Host -ForegroundColor Red "Working tree not clean. Commit or stash first."; exit 1 }
    @if (git tag --list "v{{version}}") { Write-Host -ForegroundColor Red "Tag v{{version}} already exists"; exit 1 }
    git fetch origin
    git checkout main
    git pull --ff-only origin main
    git merge --ff-only develop
    @$pyver = (Select-String -Path pyproject.toml -Pattern '^version = "(.+)"$').Matches.Groups[1].Value; \
    if ($pyver -ne "{{version}}") { \
        Write-Host -ForegroundColor Red "pyproject.toml version ($pyver) does not match {{version}}. Bump it on develop first."; \
        exit 1 \
    }
    git tag -a "v{{version}}" -m "Release {{version}}"
    git push origin main
    git push origin "v{{version}}"

# Guard for publish: must be on main, clean tree, HEAD tagged matching pyproject version
_verify-release-state:
    @if ((git rev-parse --abbrev-ref HEAD) -ne "main") { Write-Host -ForegroundColor Red "Must be on main branch to publish"; exit 1 }
    @if (git status --porcelain) { Write-Host -ForegroundColor Red "Working tree not clean"; exit 1 }
    @$pyver = (Select-String -Path pyproject.toml -Pattern '^version = "(.+)"$').Matches.Groups[1].Value; \
    $tags = @(git tag --points-at HEAD); \
    if ("v$pyver" -notin $tags) { \
        Write-Host -ForegroundColor Red "HEAD is not tagged v$pyver. Run just tag-release first."; \
        exit 1 \
    }

# --- Dependency maintenance ---

# Squash-merge every open Dependabot PR that is mergeable and green (skips conflicting/pending/failing), delete its branch, then sync develop. Requires `gh`.
merge-dependabot:
    @$prs = gh pr list --author "app/dependabot" --state open \
        --json number,title,mergeable,statusCheckRollup | ConvertFrom-Json; \
    if (-not $prs) { Write-Host -ForegroundColor Green "No open Dependabot PRs."; exit 0 }; \
    foreach ($pr in $prs) { \
        $green = @($pr.statusCheckRollup | Where-Object { $_.status -ne 'COMPLETED' -or $_.conclusion -notin @('SUCCESS','NEUTRAL','SKIPPED') }).Count -eq 0; \
        if ($pr.mergeable -ne 'MERGEABLE') { Write-Host -ForegroundColor Yellow "skip #$($pr.number) [$($pr.mergeable)] - $($pr.title)"; continue }; \
        if (-not $green)                  { Write-Host -ForegroundColor Yellow "skip #$($pr.number) [checks not green] - $($pr.title)"; continue }; \
        Write-Host -ForegroundColor Cyan "merging #$($pr.number) - $($pr.title)"; \
        gh pr merge $pr.number --squash --delete-branch; \
    }
    git checkout develop
    git pull --rebase --autostash
