import { describe, it, expect } from 'vitest'
import MarkdownChunker from './index.js'

describe('MarkdownChunker', () => {
  it('adds heading context metadata and prefix', async () => {
    const chunks = await MarkdownChunker.chunk(
      {
        id: 'doc-1',
        content: '# Title\n\n## Section\n\nHello world.',
        metadata: { source_plugin: '@vpack/source-fs' },
      },
      { size: 50, overlap: 0, min_size: 1, include_heading_prefix: true },
      { manifest: { vpack: '1.0', name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
    )

    expect(chunks.length).toBe(1)
    expect(chunks[0]?.metadata.heading_path).toEqual(['Title', 'Section'])
    expect(chunks[0]?.metadata.heading_depth).toBe(2)
    expect(chunks[0]?.text.startsWith('# Title > Section')).toBe(true)
  })

  it('extracts frontmatter into metadata and excludes it from text', async () => {
    const chunks = await MarkdownChunker.chunk(
      {
        id: 'doc-2',
        content: '---\ntitle: Doc\ncategory: notes\n---\n\n# Heading\n\nBody.',
        metadata: { source_plugin: '@vpack/source-fs' },
      },
      { size: 50, overlap: 0, min_size: 1, include_frontmatter: true },
      { manifest: { vpack: '1.0', name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
    )

    expect(chunks[0]?.metadata.title).toBe('Doc')
    expect(chunks[0]?.metadata.category).toBe('notes')
    expect(chunks[0]?.text.includes('title: Doc')).toBe(false)
  })

  it('keeps fenced code blocks intact even when oversized', async () => {
    const code = ['```ts', 'const a = 1;', 'const b = 2;', '```'].join('\n')
    const chunks = await MarkdownChunker.chunk(
      {
        id: 'doc-3',
        content: '# Code\n\n' + code,
        metadata: { source_plugin: '@vpack/source-fs' },
      },
      { size: 3, overlap: 0, min_size: 1 },
      { manifest: { vpack: '1.0', name: '@example/test', version: '0.0.0', plugins: [] }, buildId: 'b1', dryRun: false, changedChunkIds: new Set() },
    )

    expect(chunks.length).toBe(1)
    expect(chunks[0]?.text.includes('```ts')).toBe(true)
  })
})
