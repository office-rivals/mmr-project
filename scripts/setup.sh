#!/usr/bin/env bash
#
# Dev environment bootstrap: fetch dependencies for every component.
#
#   - frontend   (SvelteKit / Node)   -> npm ci
#   - api        (ASP.NET Core / .NET) -> dotnet restore
#   - mmr-api    (Go)                  -> go mod download
#
# Idempotent and safe to re-run. Resolves paths from its own location, so it
# works regardless of the current directory (e.g. when run by an Orca worktree
# setup hook). Each component is skipped if its directory or toolchain is
# missing, so a partial checkout still bootstraps what it can.
#
# Usage: scripts/setup.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    warn "$1 not found on PATH; skipping ${2:-$1} setup"
    return 1
  fi
}

setup_frontend() {
  local dir="$REPO_ROOT/frontend"
  [ -d "$dir" ] || { warn "frontend/ not found; skipping"; return; }
  require npm frontend || return
  log "frontend: installing npm dependencies"
  # npm ci is reproducible from the lockfile; fall back to install if the
  # lockfile and package.json have drifted.
  if ! npm --prefix "$dir" ci; then
    warn "npm ci failed (lockfile drift?); falling back to npm install"
    npm --prefix "$dir" install
  fi
}

setup_api() {
  local sln="$REPO_ROOT/api/MMRProject.Api/MMRProject.Api.sln"
  [ -f "$sln" ] || { warn "api solution not found; skipping"; return; }
  require dotnet api || return
  log "api: restoring .NET dependencies"
  dotnet restore "$sln"
}

setup_mmr_api() {
  local dir="$REPO_ROOT/mmr-api"
  [ -f "$dir/go.mod" ] || { warn "mmr-api/go.mod not found; skipping"; return; }
  require go mmr-api || return
  log "mmr-api: downloading Go modules"
  (cd "$dir" && go mod download)
}

main() {
  log "Bootstrapping dependencies from $REPO_ROOT"
  setup_frontend
  setup_api
  setup_mmr_api
  log "Setup complete."
}

main "$@"
