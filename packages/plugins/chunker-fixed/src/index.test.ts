import { describe, it, expect } from 'vitest'
import FixedChunker from './index.js'

describe('FixedChunker', () => {
  it('creates deterministic chunks with metadata', async () => {
    const chunks = await FixedChunker.chunk(
      { id: 'doc-1', content: 'one two three four five six', metadata: { source_plugin: '@vpack/source-fs' } },
      { size: 3, overlap: 1, min_size: 1 },
      { manifest: { vpack: "", name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
    )

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]?.metadata.chunker_plugin).toBe('@vpack/chunker-fixed')
    expect(chunks[0]?.metadata.source_id).toBe('doc-1')
  })
})
