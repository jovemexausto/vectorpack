import type { VPackEmbedder, BuildContext } from '@vpack/core'
import { embedTexts } from '@vpack/engine'

export interface FastembedEmbedderConfig {
  model: string
  dimensions: number
  provider?: 'fastembed'
  batch_size?: number
  max_length?: number
}

export const FastembedEmbedder: VPackEmbedder<FastembedEmbedderConfig> = {
  async embed(texts: string[], config: FastembedEmbedderConfig, _ctx: BuildContext): Promise<number[][]> {
    return embedTexts(texts, config as unknown as Record<string, unknown>)
  },

  dimensions(config: FastembedEmbedderConfig): number {
    return config.dimensions
  },

  modelId(config: FastembedEmbedderConfig): string {
    return config.model
  },

  async modelHash(_config: FastembedEmbedderConfig): Promise<string> {
    throw new Error('fastembed model hashes are not supported yet')
  },
}

export default FastembedEmbedder
