import type {
  VPackEngineAdapter,
  VPackIndex,
  EmbeddedChunk,
  PackManifest,
  QueryOptions,
  QueryResult,
  BuildOptions,
  MetadataFilter,
  Chunk,
} from '@vpack/core'
import { Errors } from '@vpack/core'
import { serialize, deserializePayload } from './format.js'

// ─────────────────────────────────────────────────────────────────────────────
// TsVPackIndex — in-memory index, result of a build() call
// ─────────────────────────────────────────────────────────────────────────────

class TsVPackIndex implements VPackIndex {
  constructor(
    private readonly chunks: EmbeddedChunk[],
    private readonly _manifest: PackManifest,
  ) {}

  manifest(): PackManifest {
    return this._manifest
  }

  chunkCount(): number {
    return this.chunks.length
  }

  dimensions(): number {
    return getEmbedderDimensions(this._manifest)
  }

  async query(input: string | number[], options: QueryOptions = {}): Promise<QueryResult[]> {
    if (this.chunks.length === 0) throw Errors.emptyIndex()

    const { topK = 10, minScore, filter, includeVectors = false } = options

    // input must be a pre-embedded vector in the TS impl.
    // The CLI/client layers are responsible for embedding text before calling query().
    // The Rust engine will handle text-input embedding internally.
    if (typeof input === 'string') {
      throw new Error(
        'TsEngine.query() requires a pre-embedded vector. ' +
          'Use @vpack/client which handles embedding automatically.',
      )
    }

    const queryVec = input
    const dims = this.dimensions()

    if (queryVec.length !== dims) {
      throw Errors.dimensionMismatch(dims, queryVec.length)
    }

    // Score all chunks
    let scored = this.chunks
      .filter((chunk) => (filter ? matchesFilter(chunk, filter) : true))
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryVec, chunk.vector),
      }))

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score)

    // Apply minScore filter and topK limit
    if (minScore !== undefined) {
      scored = scored.filter((r) => r.score >= minScore)
    }

    return scored.slice(0, topK).map((r, rank) => ({
      chunk: r.chunk as Chunk,
      score: r.score,
      rank,
      ...(includeVectors ? { vector: r.chunk.vector } : {}),
    }))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TsEngine — the VPackEngineAdapter implementation
// ─────────────────────────────────────────────────────────────────────────────

export const TsEngine: VPackEngineAdapter = {
  build(
    chunks: EmbeddedChunk[],
    manifest: PackManifest,
    _options: BuildOptions = {},
  ): VPackIndex {
    if (chunks.length === 0) throw Errors.emptyIndex()

    const dims = getEmbedderDimensions(manifest)
    for (const chunk of chunks) {
      if (chunk.vector.length !== dims) {
        throw Errors.dimensionMismatch(dims, chunk.vector.length)
      }
    }

    return new TsVPackIndex(chunks, manifest)
  },

  serialize(index: VPackIndex): Uint8Array {
    return serialize(index)
  },

  deserialize(bytes: Uint8Array): VPackIndex {
    // Restore the payload then re-build into a fully queryable TsVPackIndex.
    // This ensures .query(), .chunkCount(), .dimensions() all work correctly.
    const payload = deserializePayload(bytes)
    return new TsVPackIndex(payload.chunks, payload.manifest)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Math utilities
// ─────────────────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
    normA += (a[i] ?? 0) ** 2
    normB += (b[i] ?? 0) ** 2
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function getEmbedderDimensions(manifest: PackManifest): number {
  const embedder = manifest.plugins.find((p) => p.kind === 'embedder')
  const dims = embedder?.['dimensions']
  if (typeof dims !== 'number') {
    throw new Error('Embedder plugin config must include dimensions')
  }
  return dims
}

function matchesFilter(chunk: EmbeddedChunk, filter: MetadataFilter): boolean {
  const value = getNestedValue(chunk.metadata, filter.field)
  switch (filter.op) {
    case 'eq':
      return value === filter.value
    case 'neq':
      return value !== filter.value
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(value)
    case 'nin':
      return Array.isArray(filter.value) && !filter.value.includes(value)
    case 'gte':
      return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value
    case 'lte':
      return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value
    case 'exists':
      return value !== undefined && value !== null
    default:
      return false
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
