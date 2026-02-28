# Task: Setup Turborepo (local cache)
Date: 2026-02-27

## Steps
- [x] Audit current build/test/lint/typecheck scripts and package outputs for caching
- [x] Add Turborepo config (`turbo.json`) with pipeline, inputs/outputs, and dependencies
- [x] Add Turbo dependency + update root scripts to `turbo run ...`
- [x] Ensure engine native build outputs/inputs are captured for cache skipping
- [x] Verify `turbo run build` and `turbo run test` behavior
- [x] Update docs (README/setup) and add stopping point

## Notes
Local-only cache. Replace root scripts to use Turbo.
Blocked: None.

# Task: Enforce dev env deps + improve DX (Nix-first)
Date: 2026-02-27

## Steps
- [x] Audit current build/test entrypoints to decide where env checks should run
- [x] Add Nix dev shell (flake.nix) providing cargo, pkg-config, openssl
- [x] Implement env preflight script and wire into package.json scripts
- [x] Add CI job that runs in Nix shell and enforces env check
- [x] Add devcontainer config aligned with Nix shell
- [!] Verify env check + core build/test paths in Nix shell
- [x] Update docs (README/setup) and add stopping point

## Notes
Nix-first with system-package fallback (apt/brew) for non-Nix users. Target OS: Linux + macOS.
Blocked: `nix` not available locally, so `nix develop -c pnpm env:check/build/test` could not be run.

# Task: Add Markdown Chunker Plugin
Date: 2026-02-27

## Steps
- [x] Add chunker-markdown package scaffold and dependencies
- [x] Write failing tests for markdown chunking behavior
- [x] Implement markdown chunker to pass tests
- [x] Update docs (README, RFC-0001)
- [x] Run verification and update context/lessons

## Notes
Section-aware markdown chunker with heading context metadata and code block preservation.

# Task: Build Progress Logging Works Without TTY
Date: 2026-02-27

## Steps
- [x] Add tests for build progress formatting and reporter behavior
- [x] Implement CLI progress helpers and non-TTY fallback logging
- [x] Verify CLI tests and update context if needed

## Notes
Ensure chunking/embedding progress is visible even when stdout is not a TTY.

# Task: Improve Build Logging (chunking + embedding)
Date: 2026-02-27

## Steps
- [x] Add progress hooks to build pipeline (chunking + embedding)
- [x] Update CLI build command to render spinner text + embedding bar
- [x] Add build pipeline tests for progress hooks
- [x] Verify tests and update context if needed

## Notes
Chunking progress via spinner text; embedding progress via ASCII bar, throttled every 25 chunks.

# Task: Fix Markdown Chunker Build (ESM)
Date: 2026-02-27

## Steps
- [x] Identify root cause of ESM/CJS build failures in @vpack/chunker-markdown
- [x] Apply minimal fix and rerun chunker-markdown build
- [x] Verify full test suite if needed and update context if significant

## Notes
Build currently fails due to ESM-only dependencies imported from a CJS module.

# Task: Refresh README + CONTRIBUTING
Date: 2026-02-27

## Steps
- [x] Reframe README to be product-forward with concise positioning and quickstart
- [x] Add CONTRIBUTING.md with dev setup, workflows, and PR guidelines
- [x] Move non-product dev/setup details out of README (if needed)
- [x] Verify formatting and links

## Notes
Make README customer-facing; move contributor/developer content to CONTRIBUTING.

# Task: Align README with POC Positioning
Date: 2026-02-27

## Steps
- [x] Review current README for expectation-setting gaps
- [x] Add explicit POC/experimental disclaimer and collaboration guidance
- [x] Verify README formatting/links and update context stopping point

## Notes
Requested by user: make early-stage OSS expectations explicit while welcoming contributors.
