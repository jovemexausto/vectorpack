import { describe, it, expect } from 'vitest'
import SemanticChunker from './index.js'

describe('SemanticChunker', () => {
  it('throws a not implemented error', async () => {
    await expect(
      SemanticChunker.chunk(
        { id: 'doc-1', content: 'Body', metadata: { title: 'Title' } },
        {},
        { manifest: { vpack: '1.0', name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
      ),
    ).rejects.toThrow('Semantic chunking is not implemented yet. Use fixed/sentence/paragraph.')
  })
})
