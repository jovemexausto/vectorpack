import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FsSource } from './index.js'
import type { FsSourceConfig } from './index.js'
import type { BuildContext } from '@vpack/core'

// ── Temp fixture directory ────────────────────────────────────────────────────

let tmpDir: string

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vpack-source-fs-test-'))

  writeFileSync(join(tmpDir, 'hello.md'), '# Hello\nThis is a test document.')
  writeFileSync(join(tmpDir, 'world.txt'), 'Another document with some content.')
  writeFileSync(join(tmpDir, 'readme.md'), '# Readme\nThis project is VectorPack.')
  writeFileSync(join(tmpDir, 'skip.json'), '{"shouldBeSkipped": true}')

  mkdirSync(join(tmpDir, 'subdir'))
  writeFileSync(join(tmpDir, 'subdir', 'nested.md'), '# Nested\nNested document content.')
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function config(overrides: Partial<FsSourceConfig> = {}): FsSourceConfig {
  return { path: tmpDir, ...overrides }
}

const ctx: BuildContext = {
  manifest: {
    vpack: '1.0',
    name: '@test/fixture',
    version: '1.0.0',
    plugins: [],
  },
  changedChunkIds: new Set(),
  buildId: 'test',
  dryRun: false,
}

// ── fetch ─────────────────────────────────────────────────────────────────────

describe('FsSource.fetch', () => {
  it('yields documents for each matching file', async () => {
    const docs = []
    for await (const doc of FsSource.fetch(config(), ctx)) {
      docs.push(doc)
    }
    // hello.md, world.txt, readme.md, subdir/nested.md (skip.json excluded by default)
    expect(docs.length).toBe(4)
  })

  it('each document has a stable string id (relative path)', async () => {
    const docs = []
    for await (const doc of FsSource.fetch(config(), ctx)) {
      docs.push(doc)
    }
    const ids = docs.map((d) => d.id)
    expect(ids).toContain('hello.md')
    expect(ids).toContain('world.txt')
    expect(ids).toContain('readme.md')
    expect(ids).toContain(join('subdir', 'nested.md'))
  })

  it('document content matches file content', async () => {
    for await (const doc of FsSource.fetch(config({ include: ['hello.md'] }), ctx)) {
      expect(doc.content).toContain('Hello')
      expect(doc.content).toContain('test document')
    }
  })

  it('respects custom include patterns', async () => {
    const docs = []
    for await (const doc of FsSource.fetch(config({ include: ['**/*.md'] }), ctx)) {
      docs.push(doc)
    }
    expect(docs.every((d) => d.id.endsWith('.md'))).toBe(true)
    expect(docs.length).toBe(3) // hello.md, readme.md, subdir/nested.md
  })

  it('respects custom exclude patterns', async () => {
    const docs = []
    for await (const doc of FsSource.fetch(config({ exclude: ['**/subdir/**'] }), ctx)) {
      docs.push(doc)
    }
    expect(docs.every((d) => !d.id.startsWith('subdir'))).toBe(true)
  })

  it('document metadata contains expected fields', async () => {
    for await (const doc of FsSource.fetch(config({ include: ['hello.md'] }), ctx)) {
      expect(doc.metadata['_plugin']).toBe('@vpack/source-fs')
      expect(doc.metadata['extension']).toBe('.md')
      expect(typeof doc.metadata['size_bytes']).toBe('number')
      expect((doc.metadata['size_bytes'] as number)).toBeGreaterThan(0)
    }
  })

  it('document has updated_at as a Date', async () => {
    for await (const doc of FsSource.fetch(config({ include: ['hello.md'] }), ctx)) {
      expect(doc.updated_at).toBeInstanceOf(Date)
    }
  })

  it('skips .json files with default include patterns', async () => {
    const docs = []
    for await (const doc of FsSource.fetch(config(), ctx)) {
      docs.push(doc)
    }
    expect(docs.find((d) => d.id === 'skip.json')).toBeUndefined()
  })

  it('yields documents in a stable sorted order', async () => {
    const run1: string[] = []
    const run2: string[] = []
    for await (const doc of FsSource.fetch(config(), ctx)) run1.push(doc.id)
    for await (const doc of FsSource.fetch(config(), ctx)) run2.push(doc.id)
    expect(run1).toEqual(run2)
  })
})

// ── fingerprint ───────────────────────────────────────────────────────────────

describe('FsSource.fingerprint', () => {
  it('returns a hex string', async () => {
    const fp = await FsSource.fingerprint(config())
    expect(fp).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same dir returns same fingerprint', async () => {
    const fp1 = await FsSource.fingerprint(config())
    const fp2 = await FsSource.fingerprint(config())
    expect(fp1).toBe(fp2)
  })

  it('changes when a file is added', async () => {
    const before = await FsSource.fingerprint(config())
    const newFile = join(tmpDir, 'new-file.md')
    writeFileSync(newFile, '# New file')
    const after = await FsSource.fingerprint(config())
    rmSync(newFile)
    expect(before).not.toBe(after)
  })

  it('changes when a file content changes', async () => {
    const target = join(tmpDir, 'hello.md')
    const before = await FsSource.fingerprint(config({ include: ['hello.md'] }))
    writeFileSync(target, '# Hello\nModified content.')
    const after = await FsSource.fingerprint(config({ include: ['hello.md'] }))
    // Restore
    writeFileSync(target, '# Hello\nThis is a test document.')
    expect(before).not.toBe(after)
  })

  it('returns a stable empty hash for empty directory', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'vpack-empty-'))
    const fp = await FsSource.fingerprint({ path: emptyDir })
    rmSync(emptyDir, { recursive: true })
    expect(fp).toMatch(/^[a-f0-9]{64}$/)
  })
})

// ── describe ──────────────────────────────────────────────────────────────────

describe('FsSource.describe', () => {
  it('returns plugin name and version', () => {
    const desc = FsSource.describe(config())
    expect(desc.plugin).toBe('@vpack/source-fs')
    expect(desc.version).toBe('0.1.0')
  })

  it('last_fetched_at is an ISO timestamp', () => {
    const desc = FsSource.describe(config())
    expect(() => new Date(desc.last_fetched_at)).not.toThrow()
    expect(new Date(desc.last_fetched_at).toISOString()).toBe(desc.last_fetched_at)
  })
})
