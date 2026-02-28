# Codebase Assessment

Date: 2026-02-27
Scope: docs (RFC-0001..0005) vs current implementation (packages/*, engine-rust) and CLI/build pipeline behavior.

## High-confidence alignments
- Manifest as unified `plugins:` list with exactly one chunker required; enforced in build pipeline and manifest parser.
- Plugin kinds implemented: source, transformer (pre/post-chunk), chunker, embedder, output, middleware (interface + loader, though few concrete middleware plugins exist).
- Artifact format: `.vpack` v0x02 written by Rust engine; TypeScript references removed from pipeline outputs.
- Default embedder: Xenova MiniLM with hash optional; model id stored in manifest and serialized.
- Chunkers: fixed, sentence, paragraph, markdown are real and tested.

## Divergences vs RFCs
- Plugin catalog breadth: many RFC-listed plugins are absent (transformers: markdown-clean/pii/translate/summarize/extract/dedup/min-length/normalize; chunkers: semantic is stub, code/legal missing; embedders: openai/voyage/cohere/router/local-fastembed absent; outputs: registry/pg-vector/s3/webhook/slack/openai-files/export-jsonl missing; middleware: cache/telemetry/dry-run/cost/rate-limit missing).
- Registry output: RFC expects `@vpack/output-registry` and push integration; current CLI only supports `output-mcp` and no registry push in build pipeline.
- Model mismatch enforcement: RFC 8.1 calls for hard checks at query time; current TS client/engine surfaces `modelId` but no mismatch guard is implemented in adapters.
- Middleware defaults: RFC suggests cache middleware on by default; no default middleware stack is wired in CLI/build.
- Embedding options: RFC lists approved model set; implementation ships only Xenova MiniLM and fastembed (in plugins) without enforcement of “approved” list.
- Registry tiering: RFC distinguishes verified/hosted tiers; codebase does not enforce or surface tiers.
- Telemetry/cost/rate-limit: not present in code or docs beyond RFC mention.

## Operational notes
- CLI progress logging now supports non-TTY; relies on `pnpm --filter vpack build` to refresh dist before use.
- Non-Nix dev setup still requires Rust + OpenSSL headers; Nix flow unverified locally.

## Recommendations (short list)
1) Implement model mismatch checks in client/engine adapter paths; fail fast on manifest vs query model id/hash.
2) Ship at least one additional embedder (fastembed) and one output (registry or pgvector) to reduce RFC/code gap.
3) Add a default middleware stack (or document none) to align with RFC expectations.
4) Prune RFC plugin catalogue to “available” vs “planned” or add stubs with clear error messages.
