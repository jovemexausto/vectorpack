import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import { toMarkdown } from 'mdast-util-to-markdown'
import { toString } from 'mdast-util-to-string'

export interface MarkdownChunkerConfig {
  /** * Target maximum size of a chunk, measured in approximate words.
   * Note: This is a proxy for tokens. A good rule of thumb is 1 word ≈ 1.3 tokens.
   * @default 300 
   */
  size?: number
  /** * Number of words to overlap between sequential chunks to preserve context. 
   * @default 40 
   */
  overlap?: number
  /** * Minimum words required to form a valid chunk. Smaller dangling chunks are discarded.
   * @default 50 
   */
  min_size?: number
  /** * Maximum heading level to track for semantic context (e.g., 3 tracks up to ### H3).
   * Deeper headings are treated as standard text within the parent section.
   * @default undefined (tracks all headings)
   */
  heading_depth_limit?: number
  /** * If true, prepends the hierarchical heading path (e.g., `# Guide > Setup`) to each chunk. 
   * Highly recommended for vector search retrieval.
   * @default true 
   */
  include_heading_prefix?: boolean
  /** * If true, extracts basic key-value YAML frontmatter and injects it into chunk metadata.
   * @default true 
   */
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

/**
 * An opinionated Markdown chunker optimized for Vector Databases and RAG.
 * * **Behaviors:**
 * 1. **Semantic Sectioning:** Splits documents by headings, preserving the hierarchy.
 * 2. **Context Preservation:** Prepends the heading path to every chunk so the LLM knows *where* the text came from.
 * 3. **Atomic Code Blocks:** Attempts to keep code blocks together unless they grossly exceed the size limit.
 * 4. **Smart Splitting:** Falls back to paragraph splitting, and then native linguistic sentence splitting (`Intl.Segmenter`) if paragraphs are too long.
 */
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

type Section = {
  headingPath: string[]
  headingDepth: number
  nodes: unknown[]
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

    if (node.type === 'yaml') continue

    currentNodes.push(node)
  }

  flush()
  
  if (sections.length === 0 && currentNodes.length === 0) {
    sections.push({ headingPath: [], headingDepth: 0, nodes: [] })
  }

  return sections
}

/**
 * Extracts basic shallow key-value pairs from YAML.
 * Note: For production environments with complex YAML, consider using `js-yaml`.
 */
function extractFrontmatter(tree: any): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  const children: any[] = Array.isArray(tree.children) ? tree.children : []
  const yamlNode = children.find((node) => node.type === 'yaml')
  if (!yamlNode || typeof yamlNode.value !== 'string') return output

  const lines = yamlNode.value.split('\n')
  for (const line of lines) {
    // Improved regex to allow colons in the value string
    const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.+)$/)
    if (!match) continue
    const key = match[1]
    let value: string = match[2].trim()
    value = value.replace(/^['"]|['"]$/g, '')
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
    const unitWords = tokenize(unit.text)

    // Handle code blocks explicitly
    if (unit.isCode) {
      flush()
      // If code block is absurdly large (e.g., > 2x size), we must split it to avoid breaking embedding limits
      if (unitWords.length > size * 2) {
         const codeLines = unit.text.split('\n')
         let tempBlock = ''
         for (const line of codeLines) {
             tempBlock += line + '\n'
             if (tokenize(tempBlock).length >= size) {
                 chunks.push(tempBlock.trim())
                 tempBlock = ''
             }
         }
         if (tempBlock.trim().length >= minSize) chunks.push(tempBlock.trim())
      } else if (unitWords.length >= minSize) {
        chunks.push(unit.text.trim())
      }
      continue
    }

    if (unitWords.length === 0) continue

    // If a single paragraph exceeds the chunk size, we fall back to sentence-level splitting
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

    current = current ? current + '\n\n' + unitText.trim() : unitText.trim()
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

  flushParagraphs()

  return units
}

/**
 * Splits text into sentences intelligently.
 * Falls back to basic regex if Intl.Segmenter is not available in the environment.
 */
function splitSentences(text: string): string[] {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    return Array.from(segmenter.segment(text))
      .map((s) => s.segment.trim())
      .filter(Boolean)
  }
  
  // Fallback regex (prone to failing on abbreviations like e.g., Dr., etc.)
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