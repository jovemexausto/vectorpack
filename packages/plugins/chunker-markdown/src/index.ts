import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import { toMarkdown } from 'mdast-util-to-markdown'
import { toString } from 'mdast-util-to-string'

type Section = {
  headingPath: string[]
  headingDepth: number
  nodes: unknown[]
}

export interface MarkdownChunkerConfig {
  size?: number
  overlap?: number
  min_size?: number
  heading_depth_limit?: number
  include_heading_prefix?: boolean
  include_frontmatter?: boolean
}

const RESERVED_METADATA_KEYS = new Set([
  'source_plugin',
  'source_id',
  'source_url',
  'created_at',
  'updated_at',
  'pack_name',
  'chunker_plugin',
  'heading_path',
  'heading_depth',
])

export const MarkdownChunker: VPackChunker<MarkdownChunkerConfig> = {
  async chunk(doc: RawDocument, config: MarkdownChunkerConfig, ctx: BuildContext): Promise<Chunk[]> {
    const size = config.size ?? 300
    const overlap = config.overlap ?? 40
    const minSize = config.min_size ?? 50
    const includeHeadingPrefix = config.include_heading_prefix ?? true
    const includeFrontmatter = config.include_frontmatter ?? true
    const headingDepthLimit = config.heading_depth_limit

    const tree = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).parse(doc.content)
    const frontmatter = includeFrontmatter ? extractFrontmatter(tree) : {}
    const sections = splitSections(tree, headingDepthLimit)

    const chunks: Chunk[] = []
    let chunkIndex = 0

    for (const section of sections) {
      const sectionMarkdown = toMarkdown({ type: 'root', children: section.nodes } as any).trim()
      if (!sectionMarkdown) continue

      const rawChunks = chunkSectionText(sectionMarkdown, size, overlap, minSize)
      for (const rawText of rawChunks) {
        const text = includeHeadingPrefix
          ? formatHeadingPrefix(section.headingPath, section.headingDepth) + rawText
          : rawText

        chunks.push(makeChunk(doc, text, chunkIndex, ctx, section, frontmatter))
        chunkIndex += 1
      }
    }

    return chunks
  },
}

function splitSections(tree: any, headingDepthLimit?: number): Section[] {
  const sections: Section[] = []
  let currentPath: string[] = []
  let currentDepth = 0
  let currentNodes: unknown[] = []

  const children: any[] = Array.isArray(tree.children) ? tree.children : []

  const flush = () => {
    if (currentNodes.length === 0) return
    sections.push({ headingPath: [...currentPath], headingDepth: currentDepth, nodes: currentNodes })
    currentNodes = []
  }

  for (const node of children) {
    if (node.type === 'heading') {
      const depth = typeof node.depth === 'number' ? node.depth : 0
      const title = toString(node).trim()

      if (headingDepthLimit !== undefined && depth > headingDepthLimit) {
        currentNodes.push(node)
        continue
      }

      flush()
      const trimmed = currentPath.slice(0, Math.max(0, depth - 1))
      currentPath = [...trimmed, title]
      currentDepth = depth
      continue
    }

    if (node.type === 'yaml') {
      continue
    }

    currentNodes.push(node)
  }

  flush()
  if (sections.length === 0 && currentNodes.length === 0) {
    sections.push({ headingPath: [], headingDepth: 0, nodes: [] })
  }

  return sections
}

function extractFrontmatter(tree: any): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  const children: any[] = Array.isArray(tree.children) ? tree.children : []
  const yamlNode = children.find((node) => node.type === 'yaml')
  if (!yamlNode || typeof yamlNode.value !== 'string') return output

  const lines = yamlNode.value.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.+?)\s*$/)
    if (!match) continue
    const key = match[1]
    let value: unknown = match[2]
    if (typeof value === 'string') {
      value = value.replace(/^['"]|['"]$/g, '')
    }
    output[key] = value
  }

  return output
}

function chunkSectionText(text: string, size: number, overlap: number, minSize: number): string[] {
  const units = splitMarkdownUnits(text)
  const chunks: string[] = []
  let current = ''
  let currentWords: string[] = []

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed) {
      const words = tokenize(trimmed)
      if (words.length >= minSize) {
        chunks.push(trimmed)
      }
    }
    current = ''
    currentWords = []
  }

  for (const unit of units) {
    if (unit.isCode) {
      flush()
      if (tokenize(unit.text).length >= minSize) {
        chunks.push(unit.text.trim())
      }
      continue
    }

    const unitWords = tokenize(unit.text)
    if (unitWords.length === 0) continue

    if (unitWords.length > size) {
      const sentences = splitSentences(unit.text)
      for (const sentence of sentences) {
        appendUnit(sentence)
      }
      continue
    }

    appendUnit(unit.text)
  }

  flush()
  return chunks

  function appendUnit(unitText: string) {
    const unitWords = tokenize(unitText)
    if (unitWords.length === 0) return

    if (currentWords.length + unitWords.length > size && currentWords.length > 0) {
      const overlapWords = overlap > 0 ? currentWords.slice(-overlap) : []
      flush()
      if (overlapWords.length > 0) {
        currentWords = [...overlapWords]
        current = overlapWords.join(' ')
      }
    }

    if (current) {
      current += '\n\n' + unitText.trim()
    } else {
      current = unitText.trim()
    }
    currentWords = tokenize(current)
  }
}

function splitMarkdownUnits(text: string): Array<{ text: string; isCode: boolean }> {
  const lines = text.split('\n')
  const units: Array<{ text: string; isCode: boolean }> = []
  let inCode = false
  let fence = ''
  let codeLines: string[] = []
  let paragraphLines: string[] = []

  const flushParagraphs = () => {
    const raw = paragraphLines.join('\n')
    paragraphLines = []
    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    for (const paragraph of paragraphs) {
      units.push({ text: paragraph, isCode: false })
    }
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^(```|~~~)/)
    if (!inCode && fenceMatch) {
      flushParagraphs()
      inCode = true
      fence = fenceMatch[1] ?? '```'
      codeLines = [line]
      continue
    }

    if (inCode) {
      codeLines.push(line)
      if (line.startsWith(fence)) {
        units.push({ text: codeLines.join('\n'), isCode: true })
        inCode = false
        fence = ''
        codeLines = []
      }
      continue
    }

    paragraphLines.push(line)
  }

  if (inCode && codeLines.length > 0) {
    units.push({ text: codeLines.join('\n'), isCode: true })
  }

  if (paragraphLines.length > 0) {
    flushParagraphs()
  }

  return units
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  return (matches ?? []).map((s) => s.trim()).filter(Boolean)
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function formatHeadingPrefix(path: string[], depth: number): string {
  if (path.length === 0) return ''
  const label = path.join(' > ')
  const prefix = `# ${label}`
  return depth > 0 ? `${prefix}\n\n` : ''
}

function makeChunk(
  doc: RawDocument,
  text: string,
  offset: number,
  ctx: BuildContext,
  section: Section,
  frontmatter: Record<string, unknown>,
): Chunk {
  const sourcePlugin =
    (doc.metadata['_plugin'] as string | undefined) ??
    (doc.metadata['source_plugin'] as string | undefined) ??
    'unknown'

  const metadata: Record<string, unknown> = {
    source_plugin: sourcePlugin,
    source_id: doc.id,
    pack_name: ctx.manifest.name,
    chunker_plugin: '@vpack/chunker-markdown',
    heading_path: section.headingPath,
    heading_depth: section.headingDepth,
    ...doc.metadata,
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (RESERVED_METADATA_KEYS.has(key)) continue
    if (metadata[key] !== undefined) continue
    metadata[key] = value
  }

  return {
    id: deterministicId(doc.id, offset),
    text,
    metadata: metadata as Chunk['metadata'],
  }
}

function deterministicId(sourceId: string, offset: number): string {
  return `${sourceId}::${offset}`
}

export default MarkdownChunker
