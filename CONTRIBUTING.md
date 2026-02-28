# Contributing to VectorPack

Thanks for helping shape an open standard for knowledge artifacts. This guide covers how to set up the repo, develop, and submit changes.

## Principles
- Ship small, reviewable changes.
- Favor testable behavior over config tweaks.
- Keep the spec (RFCs) and implementation in sync.

## Prerequisites
- Node 20+, pnpm 9+
- Rust toolchain (for engine builds)
- OpenSSL dev headers + pkg-config
- Optional: Nix for a reproducible dev shell

## Getting set up
```bash
git clone https://github.com/vectorpack/vectorpack
cd vectorpack
pnpm install
# Optional, recommended: nix develop
pnpm env:check
```

## Everyday commands
- `pnpm build` — workspace build (Turborepo)
- `pnpm test` — workspace tests
- `pnpm vpack build` — run CLI from workspace
- `pnpm dev` — watch mode for CLI and related packages

## Developing plugins
- Sources, chunkers, embedders, outputs live under `packages/plugins/*`.
- Each plugin exports a minimal interface from `@vpack/core`.
- Add unit tests under `src/*.test.ts`; keep behavior deterministic.

## Coding guidelines
- TypeScript: strict mode already enabled; prefer explicit types over `any`.
- Rust: follow `rustfmt` defaults; keep unsafe to a minimum.
- No new runtime deps without justification; prefer dev deps.
- Keep README product-facing; add engineering detail here or in RFCs.

## Tests and verification
- Add or update tests for any behavior change; watch them fail before you fix (TDD when feasible).
- For CLI/build changes, run `pnpm --filter @vpack/build test` and `pnpm --filter vpack test`.
- For engine changes, run `pnpm --filter @vpack/engine test` (requires Rust toolchain).

## Submitting changes
1) Open a PR with a clear summary and the user impact.
2) Link related RFCs/issues.
3) Include test commands/output in the PR description.
4) Keep commits scoped; avoid force-pushes after review starts.

## Docs and RFCs
- Spec lives in `docs/RFC-0001.md` (format) and related RFCs for pipeline changes.
- If behavior changes affect the format or pipeline, update the relevant RFC and mention it in the PR.

## Support
- File issues for bugs or missing docs.
- Propose new plugins via issue or draft PR with a short design note.
