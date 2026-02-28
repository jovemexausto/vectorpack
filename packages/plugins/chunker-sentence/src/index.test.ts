import { describe, it, expect } from 'vitest'
import SentenceChunker from './index.js'

describe('SentenceChunker', () => {
  it('splits sentences and preserves metadata', async () => {
    const chunks = await SentenceChunker.chunk(
      { id: 'doc-1', content: 'One sentence. Another sentence!', metadata: { source_plugin: '@vpack/source-fs', title: 'Title' } },
      { min_size: 1 },
      { manifest: { vpack: '1.0', name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
    )

    expect(chunks.length).toBe(2)
    expect(chunks[0]?.metadata.chunker_plugin).toBe('@vpack/chunker-sentence')
  })
})
