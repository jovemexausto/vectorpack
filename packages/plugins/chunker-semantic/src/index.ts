import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'

export interface SemanticChunkerConfig {
  size?: number
  overlap?: number
  min_size?: number
}

export const SemanticChunker: VPackChunker<SemanticChunkerConfig> = {
  async chunk(_doc: RawDocument, _config: SemanticChunkerConfig, _ctx: BuildContext): Promise<Chunk[]> {
    throw new Error('Semantic chunking is not implemented yet. Use fixed/sentence/paragraph.')
  },
}

export default SemanticChunker
