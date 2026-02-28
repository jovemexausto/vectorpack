// ─────────────────────────────────────────────────────────────────────────────
// @vpack/core
// Canonical types and interfaces for the VectorPack spec (RFC-0001 v0.3.0).
// No logic. No dependencies. Everything else imports from here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Chunk ────────────────────────────────────────────────────────────────────

export interface ChunkMetadata {
  source_plugin: string         // e.g. "@vpack/source-fs"
  source_id: string             // stable identifier within the source
  source_url?: string           // human-readable origin URL
  created_at?: string           // ISO 8601
  updated_at?: string           // ISO 8601
  pack_name: string             // which pack this chunk belongs to
  chunker_plugin: string        // e.g. "@vpack/chunker-paragraph"
  [key: string]: unknown        // plugin-defined fields
}

export interface Chunk {
  /** Deterministic ID: sha256(source_id + char_offset). Stable across rebuilds. */
  id: string
  /** Original text, preserved verbatim. */
  text: string
  metadata: ChunkMetadata
}

export interface EmbeddedChunk extends Chunk {
  /** f32 embedding vector, length === index dimensions. */
  vector: number[]
}

// ── Raw document (source plugin output) ─────────────────────────────────────

export interface RawDocument {
  /** Stable identifier — must not change if content is unchanged (used for delta sync). */
  id: string
  content: string
  metadata: Record<string, unknown>
  updated_at?: Date
}

// ── Manifest ─────────────────────────────────────────────────────────────────

export type ChunkStrategy = 'fixed' | 'sentence' | 'paragraph' | 'semantic'
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot'
export type IndexType = 'hnsw' | 'flat'
export type EmbedProvider = 'local' | 'huggingface' | 'openai' | 'custom'
export type PackTier = 'verified' | 'hosted'
export type PluginKind = 'source' | 'transformer' | 'chunker' | 'embedder' | 'output' | 'middleware'
export type TransformerStage = 'pre-chunk' | 'post-chunk'

export interface EmbedConfig {
  model: string
  model_hash?: string           // sha256 of model weights — build fails on mismatch
  dimensions: number
  provider: EmbedProvider
  /** For custom providers: HTTP endpoint implementing OpenAI embeddings shape */
  endpoint?: string
}

export interface ChunkConfig {
  strategy: ChunkStrategy
  size: number                  // target tokens per chunk
  overlap: number               // token overlap between adjacent chunks
  min_size?: number             // discard chunks smaller than this
}

export interface HnswConfig {
  m: number                     // connections per node (default: 16)
  ef_construction: number       // build-time search width (default: 200)
}

export interface OutputConfig {
  metric: DistanceMetric
  index: IndexType
  hnsw?: HnswConfig
}

export interface VPackPluginConfig {
  kind: PluginKind
  use: string
  stage?: TransformerStage | undefined
  [key: string]: unknown
}

export interface PackManifest {
  vpack: string                 // spec version, e.g. "1.0"
  name: string                  // scoped registry name, e.g. "@acme/product-vision"
  version: string               // semver
  description?: string
  license?: string              // SPDX identifier
  homepage?: string
  plugins: VPackPluginConfig[]
}

// ── Source plugin interface ───────────────────────────────────────────────────

export interface SourceDescription {
  plugin: string
  version: string
  source_count?: number
  last_fetched_at: string       // ISO 8601
}

export interface VPackSource<TConfig = unknown> {
  /**
   * Yield raw documents. Streaming — do not load all into memory.
   * Called during `vpack build`.
   */
  fetch(config: TConfig, ctx: BuildContext): AsyncIterable<RawDocument>

  /**
   * Return a stable hash of the current source state.
   * Identical fingerprint = skip re-fetch (delta build).
   */
  fingerprint(config: TConfig): Promise<string>

  describe(config: TConfig): SourceDescription
}

// ── Build context ────────────────────────────────────────────────────────────

export interface BuildContext {
  readonly manifest: PackManifest
  readonly previousBuildHash?: string
  readonly changedChunkIds: Set<string>
  readonly buildId: string
  readonly dryRun: boolean
}

// ── Transformer plugin interface ─────────────────────────────────────────────

export interface VPackTransformer<TConfig = unknown> {
  transform(
    item: RawDocument | Chunk,
    config: TConfig,
    ctx: BuildContext,
  ): Promise<RawDocument | Chunk | null>
}

// ── Chunker plugin interface ─────────────────────────────────────────────────

export interface VPackChunker<TConfig = unknown> {
  chunk(doc: RawDocument, config: TConfig, ctx: BuildContext): Promise<Chunk[]>
}

// ── Embedder plugin interface ────────────────────────────────────────────────

export interface VPackEmbedder<TConfig = unknown> {
  embed(texts: string[], config: TConfig, ctx: BuildContext): Promise<number[][]>
  dimensions(config: TConfig): number
  modelId(config: TConfig): string
  modelHash(config: TConfig): Promise<string>
}

// ── Output plugin interface ──────────────────────────────────────────────────

export interface OutputDescription {
  plugin: string
  version: string
}

export interface VPackOutput<TConfig = unknown> {
  push(index: VPackIndex, config: TConfig, ctx: BuildContext): Promise<void>
  describe(config: TConfig): OutputDescription
}

// ── Middleware plugin interface ──────────────────────────────────────────────

export interface VPackMiddleware<TConfig = unknown> {
  wrap(pipeline: BuildPipeline, config: TConfig): BuildPipeline
}

export type BuildPipeline = (ctx: BuildContext) => Promise<VPackIndex>

// ── Index (in-memory, post-build) ────────────────────────────────────────────

export interface VPackIndex {
  /** Query the index. Input is plain text or a pre-embedded vector. */
  query(input: string | number[], options?: QueryOptions): Promise<QueryResult[]>
  manifest(): PackManifest
  chunkCount(): number
  dimensions(): number
}

// ── Query ────────────────────────────────────────────────────────────────────

export interface MetadataFilter {
  /** Dot-notation path into chunk.metadata, e.g. "source_plugin" */
  field: string
  op: 'eq' | 'neq' | 'in' | 'nin' | 'gte' | 'lte' | 'exists'
  value?: unknown
}

export interface QueryOptions {
  topK?: number                 // default: 10
  minScore?: number             // minimum similarity score 0–1
  filter?: MetadataFilter
  includeVectors?: boolean      // return vectors in results (default: false)
}

export interface QueryResult {
  chunk: Chunk
  score: number                 // cosine similarity, 0–1
  rank: number                  // 0-indexed position
  vector?: number[]             // only present if includeVectors: true
}

// ── Engine interface ──────────────────────────────────────────────────────────
// Implemented by @vpack/engine (TS reference) and engine-rust (Rust/napi).
// The swap between implementations is transparent to all callers.

export interface BuildOptions {
  metric?: DistanceMetric       // default: cosine
  hnsw?: HnswConfig
}

export interface VPackEngineAdapter {
  /**
   * Build an HNSW index from pre-embedded chunks.
   * Chunks must already have .vector populated.
   */
  build(chunks: EmbeddedChunk[], manifest: PackManifest, options?: BuildOptions): VPackIndex

  /**
   * Serialize a built index to the .vpack binary format.
   */
  serialize(index: VPackIndex): Uint8Array

  /**
   * Deserialize a .vpack binary back into a queryable index.
   */
  deserialize(bytes: Uint8Array): VPackIndex
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class VPackError extends Error {
  readonly code: VPackErrorCode
  constructor(code: VPackErrorCode, message: string) {
    super(message)
    this.name = 'VPackError'
    this.code = code
  }
}

export type VPackErrorCode =
  | 'DIMENSION_MISMATCH'
  | 'MODEL_MISMATCH'           // hard error — never silently proceeds
  | 'EMPTY_INDEX'
  | 'UNKNOWN_MODEL'
  | 'SERIALIZE_FAILED'
  | 'DESERIALIZE_FAILED'
  | 'SOURCE_FETCH_FAILED'
  | 'MANIFEST_INVALID'
  | 'REGISTRY_ERROR'
  | 'MODEL_HASH_MISMATCH'      // build-time: model weights don't match pinned hash

export const Errors = {
  dimensionMismatch: (expected: number, got: number) =>
    new VPackError(
      'DIMENSION_MISMATCH',
      `Dimension mismatch: index expects ${expected}d vectors, query vector is ${got}d`,
    ),

  modelMismatch: (expected: string, got: string) =>
    new VPackError(
      'MODEL_MISMATCH',
      `Model mismatch: index built with '${expected}', query uses '${got}' — results would be meaningless. This is a hard error.`,
    ),

  emptyIndex: () =>
    new VPackError('EMPTY_INDEX', 'Index is empty — call build() before query()'),

  modelHashMismatch: (model: string, expected: string, got: string) =>
    new VPackError(
      'MODEL_HASH_MISMATCH',
      `Model hash mismatch for '${model}': manifest pins ${expected}, local weights hash to ${got}. Update your manifest or re-download the model.`,
    ),
} as const

// ── Registry types ────────────────────────────────────────────────────────────

export interface PackMetadata {
  name: string
  version: string
  description?: string
  tier: PackTier
  manifest_hash: string
  published_at: string          // ISO 8601
  pull_count: number
  size_bytes: number
}

export interface RegistryQueryRequest {
  query: string                 // plain text — registry embeds using pack's model
  top_k?: number
  min_score?: number
  filter?: MetadataFilter
}

export interface RegistryQueryResponse {
  results: QueryResult[]
  model: string
  model_hash: string
}

export { parseManifest } from './manifest.js'
