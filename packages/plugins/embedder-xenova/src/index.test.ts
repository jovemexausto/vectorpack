import { describe, it, expect } from 'vitest'
import XenovaEmbedder from './index.js'

describe('XenovaEmbedder', () => {
  it('exposes model and dimensions from config', () => {
    const config = { model: 'Xenova/all-MiniLM-L6-v2', dimensions: 384, provider: 'huggingface' as const }
    expect(XenovaEmbedder.modelId(config)).toBe('Xenova/all-MiniLM-L6-v2')
    expect(XenovaEmbedder.dimensions(config)).toBe(384)
  })

  it('returns empty model hash when unset', async () => {
    const config = { model: 'Xenova/all-MiniLM-L6-v2', dimensions: 384, provider: 'huggingface' as const }
    await expect(XenovaEmbedder.modelHash(config)).resolves.toBe('')
  })
})
