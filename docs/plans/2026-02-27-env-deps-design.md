# Environment Dependencies Enforcement + DX Improvements (Nix-first)
Date: 2026-02-27

## Goals
- Enforce presence of `cargo`, `pkg-config`, and OpenSSL development headers across Linux + macOS.
- Improve developer experience with a reproducible, one-command environment.
- Fail fast with actionable guidance before expensive builds.
- Support local dev, CI, and devcontainer workflows without forcing Nix on everyone.

## Non-goals
- Supporting Windows in this iteration.
- Replacing existing build/test tooling.
- Locking the repo to Nix-only usage.

## Recommended Approach (Nix-first + preflight + CI + devcontainer)
Provide a Nix development shell as the primary reproducible path, keep system-package instructions as a fallback, and enforce preflight checks in scripts and CI. Align devcontainer with the Nix environment to avoid drift.

## Components

### 1) Nix dev shell
- Add `flake.nix` at repo root.
- Includes: Rust toolchain (stable), `pkg-config`, and `openssl`.
- Provides a default shell with `PATH` set appropriately.
- Supports Linux + macOS.

### 2) Preflight environment check
- Add `scripts/check-env.ts` (or `check-env.sh`) that verifies:
  - `cargo --version`
  - `pkg-config --version`
  - `pkg-config --libs openssl` (or equivalent)
- On failure, print:
  - OS-specific install hints for `apt` and `brew`
  - Nix option: `nix develop`
  - A clear next step (exact missing dependency)
- Wire into `package.json` as `pnpm env:check`.
- Run at the start of relevant build commands (e.g., before Rust builds).

### 3) CI enforcement
- Add CI job to run in Nix shell:
  - `nix develop -c pnpm env:check`
  - Existing build/test commands
- Ensures CI always has deps and verifies preflight consistency.

### 4) Devcontainer
- Add `.devcontainer/devcontainer.json` using a Nix-based image or Dockerfile that installs Nix.
- On startup, enter Nix dev shell and run `pnpm env:check`.
- Matches the same toolchain as local dev + CI.

## Error Handling
- Fail fast on missing binaries or headers.
- Provide exact missing dependency and direct fix instructions.
- Avoid noisy stack traces; keep messages actionable.

## Data Flow
1. Developer runs build command.
2. Preflight checks run and either:
   - pass → normal build
   - fail → actionable guidance
3. CI runs in Nix shell to guarantee consistent deps.
4. Devcontainer mirrors Nix shell for parity.

## Verification Plan
- `pnpm env:check` passes inside `nix develop` on Linux + macOS.
- CI job passes with the preflight check enabled.
- Build/test commands unchanged otherwise.

## Risks / Trade-offs
- Nix is unfamiliar to some contributors.
- Devcontainer + Nix adds setup complexity, but offers strong reproducibility.
- Keeping system-package fallback reduces friction for non‑Nix users.

## Open Questions
- Preferred Rust toolchain version pin (latest stable vs fixed version)?
- Which commands should explicitly run `pnpm env:check` (all builds vs only Rust builds)?
