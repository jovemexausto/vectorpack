# VectorPack

> npm for human knowledge — package, version, and ship knowledge like software.

[![RFC](https://img.shields.io/badge/RFC--0001-v0.1.0-blue)](./docs/RFC-0001.md)
[![RFC](https://img.shields.io/badge/RFC--0002-v0.1.0-blue)](./docs/RFC-0002.md)
[![RFC](https://img.shields.io/badge/RFC--0003-v0.1.0-blue)](./docs/RFC-0003.md)
[![RFC](https://img.shields.io/badge/RFC--0004-v0.1.0-blue)](./docs/RFC-0004.md)
[![RFC](https://img.shields.io/badge/RFC--0005-v0.1.0-blue)](./docs/RFC-0005.md)

---

## Experimental Status (POC)

VectorPack is open source in an early stage and should be treated as a proof of concept.

- Not production-ready yet: APIs, plugin contracts, and CLI behavior can change between releases.
- Recommended use today: local evaluation, prototyping, and contributor-driven experimentation.
- Collaboration is welcome: open ideas/bugs in [GitHub Issues](https://github.com/vectorpack/vectorpack/issues) or send a draft PR.
- We use early-stage language across the project (`experimental`, `alpha`, `prototype`) to keep expectations explicit.

## Why VectorPack

- Ship knowledge as a portable artifact (`.vpack`) with a contract, version, and provenance.
- Build once from any source (files, GitHub, Notion) and query anywhere (Node, browser, Rust, Python adapters coming).
- Keep recall quality stable: reproducible builds, pinned models, deterministic chunking.
- Publish to the registry and let teams depend on knowledge the same way they depend on packages.

## Quickstart (CLI)

```bash
# Install the CLI
npm install -g vpack

# Build from a manifest (vpack.yml)
vpack build

# Query locally
vpack query ./dist/pack.vpack "what do we believe about pricing?"

# Push to the registry (optional)
vpack push ./dist/pack.vpack @acme/product-vision:1.0.0
```

The first build downloads the default embedding model (`Xenova/all-MiniLM-L6-v2`).

## What you get

- **Open standard**: documented in [RFC-0001](./docs/RFC-0001.md), versioned artifacts with metadata and embeddings.
- **Plugin pipeline**: sources (fs, GitHub, Notion), chunkers (fixed, sentence, paragraph, markdown), embedders (Xenova), outputs (MCP).
- **Engines**: TypeScript reference engine; Rust/NAPI engine for production.
- **Registry**: publish and resolve packs like packages.

## Packages at a glance

```
packages/
  cli/        vpack CLI
  build/      build pipeline orchestrator
  core/       shared types/interfaces
  engine/     TS reference engine
  client/     consumer adapter
  plugins/    sources, chunkers, embedders, outputs
engine-rust/  Rust engine (native)
registry/     Fastify registry server
examples/     End-to-end samples
```

## Project status

- Maturity: **experimental / alpha** (open-source POC).
- Format: `.vpack` v0x02 (see RFC-0001).
- Default embedder: local Xenova MiniLM (offline after first download).
- Plugins: source-fs is production-ready; GitHub/Notion are stubs; markdown chunker is section-aware.

## Roadmap

- [x] Align CLI/build pipeline with Rust engine v0x02; non-TTY build progress logging
- [ ] Enforce model match at query time (manifest vs adapter)
- [ ] Add registry/output path (`@vpack/output-registry` or pgvector) and CLI push flow
- [ ] Broaden embedders (fastembed/OpenAI) with approved-model enforcement
- [ ] Ship default middleware stack (cache/telemetry) or document none
- [ ] Harden source plugins (GitHub/Notion) and add auth/docs
- [ ] Registry UX: publish/resolve flows and docs

## Contributing

We welcome plugins, bug fixes, and doc improvements. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, workflows, and review guidelines.

## License

MIT
