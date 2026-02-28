# Markdown Chunker Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a section-aware Markdown chunker plugin that preserves code blocks, includes heading context, and supports word-based sizing with overlap.

**Architecture:** Use `remark/unified` to parse Markdown into an AST, build section groups by heading hierarchy, render section content back to Markdown text, then split into chunks by word count with paragraph/sentence fallback. Preserve fenced code blocks as atomic units and attach heading metadata to each chunk.

**Tech Stack:** TypeScript, Vitest, unified/remark, mdast utilities.

---

### Task 1: Add plugin package scaffold

**Files:**
- Create: `packages/plugins/chunker-markdown/package.json`
- Create: `packages/plugins/chunker-markdown/tsconfig.json`
- Create: `packages/plugins/chunker-markdown/vitest.config.ts`

**Step 1: Create package.json**

```json
{
  "name": "@vpack/chunker-markdown",
  "version": "0.1.0",
  "description": "VectorPack chunker plugin — markdown sections",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@vpack/core": "workspace:*",
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-frontmatter": "^5.0.0",
    "mdast-util-to-markdown": "^2.1.0",
    "mdast-util-to-string": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "*",
    "vitest": "*"
  }
}
```

**Step 2: Create tsconfig**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create vitest config**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

---

### Task 2: Write failing tests for markdown chunking behavior

**Files:**
- Create: `packages/plugins/chunker-markdown/src/index.test.ts`

**Step 1: Write failing tests**

```ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @vpack/chunker-markdown test`
Expected: FAIL (module not found or behavior missing)

---

### Task 3: Implement markdown chunker to pass tests

**Files:**
- Create: `packages/plugins/chunker-markdown/src/index.ts`

**Step 1: Implement minimal parsing and chunking**

```ts
import type { VPackChunker, RawDocument, Chunk, BuildContext } from '@vpack/core'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import { toMarkdown } from 'mdast-util-to-markdown'
import { toString } from 'mdast-util-to-string'

export interface MarkdownChunkerConfig {
  size?: number
  overlap?: number
  min_size?: number
  heading_depth_limit?: number
  include_heading_prefix?: boolean
  include_frontmatter?: boolean
}

export const MarkdownChunker: VPackChunker<MarkdownChunkerConfig> = {
  async chunk(doc: RawDocument, config: MarkdownChunkerConfig, ctx: BuildContext): Promise<Chunk[]> {
    // Implementation placeholder in plan; to be filled during execution
    return []
  },
}

export default MarkdownChunker
```

**Step 2: Run tests to verify failures evolve**

Run: `pnpm --filter @vpack/chunker-markdown test`
Expected: FAIL with assertion errors (empty chunks)

**Step 3: Complete implementation to satisfy tests**

- Parse AST with frontmatter support.
- Extract sections by heading hierarchy.
- Render section content to markdown, split by paragraphs/sentences if oversized.
- Preserve fenced code blocks.
- Build chunks with word sizing + overlap.
- Attach `heading_path`, `heading_depth`, and frontmatter metadata.
- Add heading prefix line when configured.

**Step 4: Run tests to verify pass**

Run: `pnpm --filter @vpack/chunker-markdown test`
Expected: PASS

---

### Task 4: Update docs and registry references

**Files:**
- Modify: `README.md`
- Modify: `docs/RFC-0001.md`

**Step 1: Add plugin to README list**

Example entry:
```
chunker-markdown/@vpack/chunker-markdown — markdown section chunks
```

**Step 2: Update RFC-0001 plugin table**

Add a row describing `@vpack/chunker-markdown`.

**Step 3: Run tests**

Run: `pnpm --filter @vpack/chunker-markdown test`
Expected: PASS

---

### Task 5: Verify and document stopping point

**Files:**
- Modify: `tasks/context.md`
- Modify: `tasks/lessons.md` (if needed)

**Step 1: Run full verification**

Run: `pnpm test`
Expected: PASS

**Step 2: Update context stopping point**

Add a new stopping point with last completed work and next steps.

---

