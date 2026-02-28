#!/usr/bin/env bash
set -euo pipefail

missing=0

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

note() {
  printf '%s\n' "$*"
}

fail() {
  missing=1
  note "$*"
}

if ! has_cmd cargo; then
  fail "Missing: cargo"
fi

if ! has_cmd pkg-config; then
  fail "Missing: pkg-config"
fi

if has_cmd pkg-config; then
  if ! pkg-config --libs openssl >/dev/null 2>&1; then
    fail "Missing: OpenSSL development headers (pkg-config could not find openssl)"
  fi
fi

if [ "$missing" -ne 0 ]; then
  note ""
  note "Environment setup required. Choose one:"
  note ""
  note "  Nix (recommended):"
  note "    pnpm nix:dev (wraps nix develop)"
  note ""
  note "  macOS (Homebrew):"
  note "    brew install rust pkg-config openssl@3"
  note "    # If pkg-config still can't find OpenSSL, ensure brew is on PATH and try:"
  note "    #   export PKG_CONFIG_PATH=\"$(brew --prefix openssl@3)/lib/pkgconfig\""
  note ""
  note "  Ubuntu/Debian (apt):"
  note "    sudo apt-get update && sudo apt-get install -y cargo pkg-config libssl-dev"
  note ""
  note "After installing, re-run: pnpm env:check"
  exit 1
fi

note "Environment OK"
