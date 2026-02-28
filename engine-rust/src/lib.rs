// vpack-engine — Rust implementation
//
// This crate is the Phase 2 replacement for @vpack/engine (TypeScript).
// The external interface matches VPackEngineAdapter from @vpack/core exactly.
// Callers never know which implementation is running.
//
// Modules:
//   chunk     — Chunk and EmbeddedChunk types
//   index     — VPackIndex: HNSW build + query
//   serialize — .vpack binary format (columnar layout per RFC-0001 §3.1)
//   query     — scoring, filtering, result ranking
//   error     — VPackError enum (all error codes from RFC-0001 §9.4)
//   math      — vector distance functions (cosine, euclidean, dot)
//   napi      — napi-rs Node.js bindings (feature = "napi")

pub mod chunk;
pub mod embeddings;
pub mod error;
pub mod index;
pub mod math;
pub mod query;
pub mod serialize;

#[cfg(feature = "napi")]
pub mod napi_bindings;

#[cfg(feature = "wasm")]
pub mod wasm_bindings;

// Re-export the public API
pub use chunk::{Chunk, ChunkMetadata, EmbeddedChunk};
pub use error::VPackError;
pub use index::VPackIndex;
pub use query::{QueryOptions, QueryResult};
pub use serialize::{deserialize, serialize};
