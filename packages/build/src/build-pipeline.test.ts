import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPack } from './build-pipeline.js'
import type { PackManifest } from '@vpack/core'
import { engine } from '@vpack/engine'

const reporter = {
  start() {},
  succeed() {},
  fail() {},
  setText() {},
}

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vpack-build-test-'))
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'tmp-build', type: 'module' }))
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeModule(name: string, code: string): string {
  const p = join(tmpDir, name)
  writeFileSync(p, code)
  return p
}

describe('runBuild', () => {
  it('runs plugin pipeline in order and serializes output', async () => {
    writeFileSync(join(tmpDir, 'vpack.yml'), '')

    writeModule('source.mjs', `export default {
  async *fetch(_config, _ctx) {
    yield { id: 'doc-1', content: 'hello world', metadata: {} }
  },
  async fingerprint() { return 'fp' },
  describe() { return { plugin: 'source', version: '0.1.0', last_fetched_at: new Date().toISOString() } }
}`)

    writeModule('pre.mjs', `export default {
  async transform(item) {
    return { ...item, content: item.content + ' pre' }
  }
}`)

    writeModule('chunker.mjs', `export default {
  async chunk(doc) {
    return [{ id: doc.id + '::0', text: doc.content, metadata: { ...doc.metadata } }]
  }
}`)

    writeModule('post.mjs', `export default {
  async transform(item) {
    return { ...item, text: item.text + ' post' }
  }
}`)

    writeModule('embedder.mjs', `import { writeFileSync } from 'node:fs'
export default {
  async embed(texts, config) {
    writeFileSync(config.marker_path, texts.join('\\n'))
    return texts.map(() => [1, 0])
  },
  dimensions(config) { return config.dimensions },
  modelId() { return 'test-model' },
  async modelHash() { return 'hash' }
}`)

    writeModule('output.mjs', `import { writeFileSync } from 'node:fs'
export default {
  async push(index, config) {
    writeFileSync(config.marker_path, String(index.chunkCount()))
  },
  describe() { return { plugin: 'output', version: '0.1.0' } }
}`)

    const outputPath = join(tmpDir, 'pack.vpack')
    const markerPath = join(tmpDir, 'output.txt')
    const embedderMarkerPath = join(tmpDir, 'embedder.txt')

    const manifest: PackManifest = {
      vpack: '1.0',
      name: '@test/build',
      version: '1.0.0',
      plugins: [
        { kind: 'source', use: './source.mjs' },
        { kind: 'transformer', use: './pre.mjs', stage: 'pre-chunk' },
        { kind: 'chunker', use: './chunker.mjs' },
        { kind: 'transformer', use: './post.mjs', stage: 'post-chunk' },
        { kind: 'embedder', use: './embedder.mjs', dimensions: 2, marker_path: embedderMarkerPath },
        { kind: 'output', use: './output.mjs', marker_path: markerPath },
      ],
    }

    await buildPack({
      manifest,
      manifestPath: join(tmpDir, 'vpack.yml'),
      output: outputPath,
      cache: false,
      reporter,
    })

    const bytes = readFileSync(outputPath)
    const index = engine.deserialize(new Uint8Array(bytes))
    const embedderText = readFileSync(embedderMarkerPath, 'utf8').trim()

    expect(index.chunkCount()).toBe(1)
    expect(embedderText).toBe('hello world pre post')
    expect(existsSync(markerPath)).toBe(true)
  })

  it('reports chunking and embedding progress', async () => {
    writeFileSync(join(tmpDir, 'vpack.yml'), '')

    writeModule('source.mjs', `export default {
  async *fetch() {
    yield { id: 'doc-1', content: 'alpha', metadata: {} }
    yield { id: 'doc-2', content: 'beta', metadata: {} }
  },
  async fingerprint() { return 'fp' },
  describe() { return { plugin: 'source', version: '0.1.0', last_fetched_at: new Date().toISOString() } }
}`)

    writeModule('chunker.mjs', `export default {
  async chunk(doc, config) {
    const count = config.count ?? 1
    return Array.from({ length: count }, (_, i) => ({
      id: doc.id + '::' + i,
      text: doc.content + ' ' + i,
      metadata: {}
    }))
  }
}`)

    writeModule('embedder.mjs', `export default {
  async embed(texts) {
    return texts.map(() => [0])
  },
  dimensions() { return 1 },
  modelId() { return 'test-model' },
  async modelHash() { return 'hash' }
}`)

    const outputPath = join(tmpDir, 'pack.vpack')
    const chunkCalls: Array<{ source: string; docs: number; chunks: number }> = []
    const embedCalls: Array<{ current: number; total: number }> = []

    const manifest: PackManifest = {
      vpack: '1.0',
      name: '@test/build-progress',
      version: '1.0.0',
      plugins: [
        { kind: 'source', use: './source.mjs' },
        { kind: 'chunker', use: './chunker.mjs', count: 15 },
        { kind: 'embedder', use: './embedder.mjs', dimensions: 1 },
      ],
    }

    await buildPack({
      manifest,
      manifestPath: join(tmpDir, 'vpack.yml'),
      output: outputPath,
      cache: false,
      reporter: {
        ...reporter,
        onChunkProgress: (info) => chunkCalls.push(info),
        onEmbedProgress: (info) => embedCalls.push(info),
      },
    })

    expect(chunkCalls).toEqual([
      { source: './source.mjs', docs: 1, chunks: 15 },
      { source: './source.mjs', docs: 2, chunks: 30 },
    ])
    expect(embedCalls.some((entry) => entry.current === 25 && entry.total === 30)).toBe(true)
    expect(embedCalls.some((entry) => entry.current === 30 && entry.total === 30)).toBe(true)
  })
})
