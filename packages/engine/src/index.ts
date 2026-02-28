// @vpack/engine — Rust implementation via napi
//
// The exported interface (VPackEngineAdapter) does not change.
// All callers are unaffected by the swap.

export { RustEngine as engine } from './rust-engine.js'
export { embedTexts } from './rust-engine.js'
export type { SerializedIndex } from './format.js'
