# Context
## Stopping Point — 2026-02-26
**Last completed:** Remove invalid yields in source-github/source-notion; build passes.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-26
**Last completed:** Fixed CLI dev execution: CJS core exports, workspace plugin loading, and wrapper to honor INIT_CWD/VPACK_WORKSPACE_ROOT. Verified engine tests and vpack build via temp manifest.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-26
**Last completed:** Updated engine CJS interop test to avoid import.meta; engine tests pass.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-26
**Last completed:** Implemented Xenova embeddings pipeline, manifest model_hash optional, query embedding, docs/examples updated; CLI tests pass.
**Next step:** Provide Hugging Face access for model download; re-run `pnpm vpack build` + `pnpm vpack query`.
**Blockers:** Hugging Face model download requires access; sharp dependency patched via patch-package.
## Stopping Point — 2026-02-26
**Last completed:** Implemented fixed/sentence/paragraph chunkers with tests; semantic now errors; example uses paragraph + min_size 1.
**Next step:** Provide HF access to download model; rerun end-to-end build/query.
**Blockers:** Hugging Face model download unauthorized for all-MiniLM-L6-v2.
## Stopping Point — 2026-02-26
**Last completed:** Updated model id to Xenova namespace; end-to-end `vpack build` + `vpack query` succeed.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-26
**Last completed:** Updated basic-fs docs and README with product strategy narrative and clearer example queries.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** End-to-end build and query verified with @vpack/client path (`pnpm vpack build` + `pnpm vpack query`).
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Removed generated JS/DTS artifacts from `packages/client/src` and added ignore rules to keep src TS-only; verified client build outputs to `dist`.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Aligned code with RFC plugin system: manifest parser in core, plugins pipeline in CLI, new chunker/embedder plugins, docs/examples updated, tests/build passing.
**Next step:** Decide build pipeline host package (client/build/engine) in next pass.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Moved build pipeline into @vpack/build, updated CLI to call it, added build package tests, and verified builds/tests.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Removed shorthand manifest support; manifests now require plugins-only, parser errors on deprecated fields; RFC migration updated and tests/build verified.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Migrated sink-mcp to output-mcp under packages/outputs, updated plugin loaders and docs, and verified tests/build.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Enforced outputs as plugins by moving output-mcp under packages/plugins, removing sink aliases, updating loaders/docs/workspace, refreshing lockfile, and verifying tests/build.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Implemented Rust engine core, NAPI bindings, and TS adapter scaffolding; updated tests/docs and build scripts.
**Next step:** Install Rust toolchain (`cargo`) to build the native addon and run verification.
**Blockers:** `cargo` not found when running `cargo test -p vpack-engine` and `pnpm --filter @vpack/engine build`.
## Stopping Point — 2026-02-27
**Last completed:** Rust engine migration complete: NAPI addon builds, tests pass, and workspace builds succeed with v0x02 format.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** RFC-0006 updated to require Rust build handlers for embed/index/serialize while keeping TS plugins as the authoring surface.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Started verification for RFC-0006 work; Rust native build failed due to missing system dependencies.
**Next step:** Install `pkg-config` and OpenSSL dev headers (e.g., `libssl-dev`), then rerun engine build/tests and workspace build.
**Blockers:** Rust build requires `pkg-config` and OpenSSL development headers.
## Stopping Point — 2026-02-27
**Last completed:** Verification complete for RFC-0006 work: engine build/test pass and `pnpm -r build` succeeds.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** `pnpm test` passes after adding minimal plugin tests and local Vitest configs; build pipeline test updated for Rust index.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Added Turborepo config and switched root scripts to `turbo run ...`; `pnpm install` added turbo. Initial `pnpm run build` failed in `@vpack/chunker-sentence` due to `RawDocument` type mismatch in `src/index.test.ts`.
**Next step:** Fix or adjust the failing test/build in `@vpack/chunker-sentence`, then re-run `pnpm run build` and `pnpm run test`, update README.
**Blockers:** Build verification blocked by `src/index.test.ts` using `title` not in `RawDocument`.
## Stopping Point — 2026-02-27
**Last completed:** Turborepo setup complete with local cache; root scripts use `turbo run ...`, tests/builds pass, README updated. Fixed chunker tests to match `RawDocument` and added `.turbo/` to `.gitignore`.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Added Nix dev shell (`flake.nix`), env preflight script, Nix-based CI job, and devcontainer config; README updated with Nix/system setup guidance. `pnpm env:check` passes locally.
**Next step:** Run `nix develop -c pnpm env:check/build/test` on a machine with Nix to verify the dev shell and generate `flake.lock`.
**Blockers:** `nix` CLI not installed in this environment, so Nix-based verification not run.
## Stopping Point — 2026-02-27
**Last completed:** Added @vpack/chunker-markdown plugin with section-aware markdown chunking, tests, and docs update; pnpm test passes.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Added build progress hooks and CLI spinner/progress bar updates for chunking and embedding; tests pass.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Added non-TTY build progress logging with tested CLI helpers; chunking and embedding progress now visible without spinner support.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Refreshed README with product positioning/quickstart and added CONTRIBUTING with dev/PR guidelines; progress logging non-TTY tested.
**Next step:** None.
**Blockers:** None.
## Stopping Point — 2026-02-27
**Last completed:** Added explicit README POC/experimental positioning, expectations, and collaboration channel (GitHub Issues) near the top-level project overview.
**Next step:** None.
**Blockers:** None.
