import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'

export interface ParagraphChunkerConfig {
  min_size?: number
}

export const ParagraphChunker: VPackChunker<ParagraphChunkerConfig> = {
  async chunk(doc: RawDocument, config: ParagraphChunkerConfig, ctx: BuildContext): Promise<Chunk[]> {
    const minSize = config.min_size ?? 20
    const units = splitParagraphs(doc.content)
    const chunks: Chunk[] = []

    let chunkIndex = 0
    for (const unit of units) {
      const unitWords = tokenize(unit)
      if (unitWords.length === 0) continue
      if (unitWords.length < minSize) continue
      chunks.push(makeChunk(doc, unit, chunkIndex, ctx))
      chunkIndex += 1
    }

    return chunks
  },
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
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
      chunker_plugin: '@vpack/chunker-paragraph',
      ...doc.metadata,
    },
  }
}

function deterministicId(sourceId: string, offset: number): string {
  return `${sourceId}::${offset}`
}

export default ParagraphChunker
