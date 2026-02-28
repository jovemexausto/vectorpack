import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { engine } from '@vpack/engine'
import type { EmbeddedChunk, PackManifest } from '@vpack/core'
import { load } from './index.js'

let tmpDir: string
let packPath: string

function makeManifest(): PackManifest {
  return {
    vpack: '1.0',
    name: '@test/pack',
    version: '1.0.0',
    plugins: [
      { kind: 'source', use: '@vpack/source-fs', path: './docs' },
      { kind: 'chunker', use: '@vpack/chunker-fixed', size: 10, overlap: 0, min_size: 1 },
      {
        kind: 'embedder',
        use: '@vpack/embedder-xenova',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 3,
        provider: 'huggingface',
      },
    ],
  }
}

function makeChunk(id: string, vector: number[]): EmbeddedChunk {
  return {
    id,
    text: `Text for ${id}`,
    metadata: {
      source_plugin: '@vpack/source-fs',
      source_id: id,
      pack_name: '@test/pack',
      chunker_plugin: '@vpack/chunker-fixed',
    },
    vector,
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vpack-client-'))
  const manifest = makeManifest()
  const index = engine.build([makeChunk('a', [1, 0, 0])], manifest)
  const bytes = engine.serialize(index)
  packPath = join(tmpDir, 'pack.vpack')
  writeFileSync(packPath, bytes)
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('load', () => {
  it('loads a local pack and queries with embed override', async () => {
    const kb = await load(packPath, {
      embed: async () => [1, 0, 0],
    })
    const results = await kb.query('hello', { topK: 1 })
    expect(results.length).toBe(1)
    expect(results[0]?.chunk.id).toBe('a')
  })

  it('rejects registry references', async () => {
    await expect(load('@acme/pack:1.0.0')).rejects.toThrow(/registry/i)
  })
})
