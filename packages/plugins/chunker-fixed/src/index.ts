import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'

export interface FixedChunkerConfig {
  size: number
  overlap: number
  min_size?: number
}

export const FixedChunker: VPackChunker<FixedChunkerConfig> = {
  async chunk(doc: RawDocument, config: FixedChunkerConfig, ctx: BuildContext): Promise<Chunk[]> {
    const size = config.size
    const overlap = config.overlap
    const minSize = config.min_size ?? 20

    const words = tokenize(doc.content)
    const chunks: Chunk[] = []
    let offset = 0

    while (offset < words.length) {
      const slice = words.slice(offset, offset + size)
      if (slice.length < size || slice.length < minSize) {
        break
      }
      const text = slice.join(' ')
      chunks.push(makeChunk(doc, text, offset, ctx))
      offset += Math.max(1, size - overlap)
    }

    return chunks
  },
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function makeChunk(doc: RawDocument, text: string, offset: number, ctx: BuildContext): Chunk {
  const sourcePlugin =
    (doc.metadata['_plugin'] as string | undefined) ??
    (doc.metadata['source_plugin'] as string | undefined) ??
    'unknown'
  return {
    id: deterministicId(doc.id, offset),
    text,
    metadata: {
      source_plugin: sourcePlugin,
      source_id: doc.id,
      pack_name: ctx.manifest.name,
      chunker_plugin: '@vpack/chunker-fixed',
      ...doc.metadata,
    },
  }
}

function deterministicId(sourceId: string, offset: number): string {
  return `${sourceId}::${offset}`
}

export default FixedChunker
