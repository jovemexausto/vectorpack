import { describe, it, expect } from 'vitest'
import { engine } from './index.js'
import type { EmbeddedChunk, PackManifest } from '@vpack/core'
import { VPackError } from '@vpack/core'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeManifest(dimensions = 3): PackManifest {
  return {
    vpack: '1.0',
    name: '@test/fixture',
    version: '1.0.0',
    plugins: [
      { kind: 'source', use: '@vpack/source-fs', path: './docs' },
      { kind: 'chunker', use: '@vpack/chunker-fixed', size: 512, overlap: 64, min_size: 1 },
      {
        kind: 'embedder',
        use: '@vpack/embedder-xenova',
        model: 'Xenova/all-MiniLM-L6-v2',
        model_hash: 'sha256:test',
        dimensions,
        provider: 'huggingface',
      },
    ],
  }
}

function makeChunk(id: string, vector: number[], text = `Text for ${id}`): EmbeddedChunk {
  return {
    id,
    text,
    metadata: {
      source_plugin: '@vpack/source-fs',
      source_id: id,
      pack_name: '@test/fixture',
      chunker_plugin: '@vpack/chunker-fixed',
    },
    vector,
  }
}

const CHUNKS_3D: EmbeddedChunk[] = [
  makeChunk('pricing',    [1, 0, 0], 'Pricing should reflect value delivered'),
  makeChunk('deployment', [0, 1, 0], 'Deploy using blue-green strategy'),
  makeChunk('culture',    [0, 0, 1], 'We value radical candor and async work'),
]

// ── engine.build ──────────────────────────────────────────────────────────────

describe('engine.build', () => {
  it('returns an index with correct chunk count', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    expect(index.chunkCount()).toBe(3)
  })

  it('returns an index with correct dimensions', () => {
    const index = engine.build(CHUNKS_3D, makeManifest(3))
    expect(index.dimensions()).toBe(3)
  })

  it('throws EMPTY_INDEX when chunks array is empty', () => {
    expect(() => engine.build([], makeManifest())).toThrowError(VPackError)
    expect(() => engine.build([], makeManifest())).toThrow('empty')
  })

  it('throws DIMENSION_MISMATCH when a chunk vector length is wrong', () => {
    const badChunk = makeChunk('bad', [1, 0]) // 2d but manifest says 3d
    expect(() => engine.build([badChunk], makeManifest(3))).toThrowError(VPackError)
  })

  it('manifest() returns the original manifest', () => {
    const manifest = makeManifest()
    const index = engine.build(CHUNKS_3D, manifest)
    expect(index.manifest().name).toBe('@test/fixture')
    const embedder = index.manifest().plugins.find((p) => p.kind === 'embedder')
    expect(embedder?.['model']).toBe('Xenova/all-MiniLM-L6-v2')
  })
})

// ── engine.query ──────────────────────────────────────────────────────────────

describe('engine.query', () => {
  it('returns the closest chunk first', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const results = await index.query([1, 0, 0])  // points at "pricing"
    expect(results[0]!.chunk.id).toBe('pricing')
    expect(results[0]!.score).toBeCloseTo(1.0, 5)
    expect(results[0]!.rank).toBe(0)
  })

  it('ranks results in descending score order', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const results = await index.query([1, 0, 0])
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score)
    }
  })

  it('respects topK option', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const results = await index.query([1, 0, 0], { topK: 1 })
    expect(results).toHaveLength(1)
  })

  it('respects minScore option — filters low-scoring results', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    // [1,0,0] is orthogonal to [0,1,0] and [0,0,1] → cosine = 0
    const results = await index.query([1, 0, 0], { minScore: 0.5 })
    expect(results.every((r) => r.score >= 0.5)).toBe(true)
    expect(results).toHaveLength(1) // only "pricing" matches
  })

  it('throws DIMENSION_MISMATCH for wrong vector length', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest(3))
    await expect(index.query([1, 0])).rejects.toThrowError(VPackError)
  })

  it('throws on string input (TS engine requires pre-embedded vectors)', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    await expect(index.query('what is our pricing?')).rejects.toThrow()
  })

  it('includes vectors when includeVectors: true', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const results = await index.query([1, 0, 0], { includeVectors: true })
    expect(results[0]!.vector).toBeDefined()
    expect(results[0]!.vector).toHaveLength(3)
  })

  it('does not include vectors by default', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const results = await index.query([1, 0, 0])
    expect(results[0]!.vector).toBeUndefined()
  })
})

// ── metadata filter ───────────────────────────────────────────────────────────

describe('engine.query — metadata filter', () => {
  const mixedChunks: EmbeddedChunk[] = [
    { ...makeChunk('a', [1, 0, 0]), metadata: { source_plugin: '@vpack/source-fs',   source_id: 'a', pack_name: 'test', chunker_plugin: '@vpack/chunker-fixed', category: 'finance' } },
    { ...makeChunk('b', [0.9, 0.1, 0]), metadata: { source_plugin: '@vpack/source-notion', source_id: 'b', pack_name: 'test', chunker_plugin: '@vpack/chunker-fixed', category: 'engineering' } },
    { ...makeChunk('c', [0.8, 0.2, 0]), metadata: { source_plugin: '@vpack/source-fs',   source_id: 'c', pack_name: 'test', chunker_plugin: '@vpack/chunker-fixed', category: 'finance' } },
  ]

  it('filter eq — returns only matching chunks', async () => {
    const index = engine.build(mixedChunks, makeManifest())
    const results = await index.query([1, 0, 0], {
      filter: { field: 'source_plugin', op: 'eq', value: '@vpack/source-fs' },
    })
    expect(results.every((r) => r.chunk.metadata.source_plugin === '@vpack/source-fs')).toBe(true)
    expect(results).toHaveLength(2)
  })

  it('filter neq — excludes matching chunks', async () => {
    const index = engine.build(mixedChunks, makeManifest())
    const results = await index.query([1, 0, 0], {
      filter: { field: 'source_plugin', op: 'neq', value: '@vpack/source-notion' },
    })
    expect(results.every((r) => r.chunk.metadata.source_plugin !== '@vpack/source-notion')).toBe(true)
  })

  it('filter in — returns chunks whose field value is in the list', async () => {
    const index = engine.build(mixedChunks, makeManifest())
    const results = await index.query([1, 0, 0], {
      filter: { field: 'category', op: 'in', value: ['finance'] },
    })
    expect(results).toHaveLength(2)
  })

  it('filter exists — returns only chunks with the field present', async () => {
    const index = engine.build(mixedChunks, makeManifest())
    const results = await index.query([1, 0, 0], {
      filter: { field: 'category', op: 'exists' },
    })
    expect(results).toHaveLength(3)
  })
})

// ── serialize / deserialize round-trip ───────────────────────────────────────

describe('engine.serialize / deserialize', () => {
  it('round-trip preserves chunk count', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    const restored = engine.deserialize(bytes)
    expect(restored.chunkCount()).toBe(3)
  })

  it('round-trip preserves dimensions', () => {
    const index = engine.build(CHUNKS_3D, makeManifest(3))
    const bytes = engine.serialize(index)
    const restored = engine.deserialize(bytes)
    expect(restored.dimensions()).toBe(3)
  })

  it('round-trip preserves manifest name and model', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    const restored = engine.deserialize(bytes)
    expect(restored.manifest().name).toBe('@test/fixture')
    const embedder = restored.manifest().plugins.find((p) => p.kind === 'embedder')
    expect(embedder?.['model']).toBe('Xenova/all-MiniLM-L6-v2')
  })

  it('round-trip — restored index is queryable with same results', async () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    const restored = engine.deserialize(bytes)

    const original = await index.query([1, 0, 0], { topK: 1 })
    const fromDisk  = await restored.query([1, 0, 0], { topK: 1 })

    expect(fromDisk[0]!.chunk.id).toBe(original[0]!.chunk.id)
    expect(fromDisk[0]!.score).toBeCloseTo(original[0]!.score, 5)
  })

  it('serialized bytes start with VPAK magic', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    // "VPAK" = 0x56 0x50 0x41 0x4b
    expect(bytes[0]).toBe(0x56)
    expect(bytes[1]).toBe(0x50)
    expect(bytes[2]).toBe(0x41)
    expect(bytes[3]).toBe(0x4b)
  })

  it('serialized bytes use format version 0x02', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    expect(bytes[4]).toBe(0x02)
  })

  it('deserialize rejects legacy format version 0x01', () => {
    const legacy = new Uint8Array([0x56, 0x50, 0x41, 0x4b, 0x01, 0, 0, 0, 0])
    expect(() => engine.deserialize(legacy)).toThrow()
  })

  it('deserialize throws on garbage bytes', () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])
    expect(() => engine.deserialize(garbage)).toThrow()
  })

  it('deserialize throws on truncated valid header', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    const truncated = bytes.slice(0, 12) // valid magic + version, but truncated payload
    expect(() => engine.deserialize(truncated)).toThrow()
  })

  it('serialized output is a Uint8Array', () => {
    const index = engine.build(CHUNKS_3D, makeManifest())
    const bytes = engine.serialize(index)
    expect(bytes).toBeInstanceOf(Uint8Array)
  })
})

// ── cosine similarity properties ─────────────────────────────────────────────

describe('cosine similarity properties', () => {
  it('identical vectors score 1.0', async () => {
    const chunk = makeChunk('a', [0.6, 0.8, 0])
    const index = engine.build([chunk], makeManifest())
    const results = await index.query([0.6, 0.8, 0])
    expect(results[0]!.score).toBeCloseTo(1.0, 5)
  })

  it('orthogonal vectors score 0.0', async () => {
    const chunks = [
      makeChunk('x', [1, 0, 0]),
      makeChunk('y', [0, 1, 0]),
    ]
    const index = engine.build(chunks, makeManifest())
    const results = await index.query([0, 1, 0])
    const xResult = results.find((r) => r.chunk.id === 'x')!
    expect(xResult.score).toBeCloseTo(0, 5)
  })

  it('score is symmetric', async () => {
    const chunks = [
      makeChunk('a', [0.5, 0.5, 0.7]),
      makeChunk('b', [0.3, 0.9, 0.1]),
    ]
    const index = engine.build(chunks, makeManifest())
    const [r1] = await index.query([0.3, 0.9, 0.1], { topK: 1 })
    const [r2] = await index.query([0.5, 0.5, 0.7], { topK: 1 })
    expect(r1!.chunk.id).toBe('b')
    expect(r2!.chunk.id).toBe('a')
  })
})
