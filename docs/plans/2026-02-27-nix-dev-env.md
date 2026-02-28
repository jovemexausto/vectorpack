# Nix-First Dev Environment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a reproducible Nix dev environment, fast preflight checks, CI enforcement, and a devcontainer aligned with Nix for consistent DX.

**Architecture:** Add a `flake.nix` dev shell that includes Rust, `pkg-config`, and OpenSSL. Implement a preflight script that validates these tools on any system and wire it into root scripts/CI. Add a devcontainer that enters the same Nix environment to keep parity.

**Tech Stack:** Nix flakes, pnpm, Node/TypeScript (or shell), Docker devcontainer.

---

### Task 1: Audit current entrypoints and Rust deps

**Files:**
- Review: `package.json`
- Review: `packages/engine/package.json`
- Review: `engine-rust/`

**Step 1: Identify commands that should run preflight**
- Note where Rust native builds run (`@vpack/engine` build/test).
- Note root scripts that should invoke preflight (`build`, `test`, `dev`).

**Step 2: Confirm CI workflow**
- Locate CI workflow file and identify current build/test steps.

### Task 2: Add Nix dev shell

**Files:**
- Create: `flake.nix`
- Create: `flake.lock` (generated)

**Step 1: Create flake with devShell**
- Include `rustc`, `cargo`, `pkg-config`, `openssl`, and `nodejs` (matching Node 20 if available).
- Expose a `devShells.default` usable via `nix develop`.

**Step 2: Verify Nix shell works locally**
- Run: `nix develop -c cargo --version`
- Run: `nix develop -c pkg-config --version`
- Run: `nix develop -c pkg-config --libs openssl`

### Task 3: Add preflight script

**Files:**
- Create: `scripts/check-env.sh` (or `.ts`)
- Modify: `package.json`

**Step 1: Implement checks**
- Check for `cargo`, `pkg-config`.
- Check that `pkg-config --libs openssl` succeeds.
- Print actionable install hints for macOS (brew) and Linux (apt) plus Nix shortcut.

**Step 2: Wire into scripts**
- Add `env:check` script.
- Add `prebuild` or `pretest` at root to invoke `pnpm env:check`.

### Task 4: CI enforcement

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add Nix-based job or step**
- Install Nix in CI.
- Run: `nix develop -c pnpm env:check`
- Run existing build/test steps inside `nix develop -c`.

### Task 5: Devcontainer parity

**Files:**
- Create: `.devcontainer/devcontainer.json`
- Create: `.devcontainer/Dockerfile` (if needed)

**Step 1: Devcontainer setup**
- Use a base image with Nix installed (or install Nix in Dockerfile).
- Set `postCreateCommand` to `nix develop -c pnpm env:check`.

### Task 6: Verification + docs

**Files:**
- Modify: `README.md`
- Modify: `tasks/context.md`

**Step 1: Verify**
- Run: `pnpm env:check` outside Nix (ensure helpful error if missing).
- Run: `nix develop -c pnpm env:check` (success).
- Run: `nix develop -c pnpm run build` (success).

**Step 2: Update docs and stopping point**
- Add Nix/devcontainer instructions and system package alternatives.
- Record stopping point.

---

## Execution Notes
- Use `flake.nix` (preferred).
- Keep non-Nix instructions available (apt/brew).
