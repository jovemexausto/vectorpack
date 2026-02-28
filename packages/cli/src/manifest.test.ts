import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readManifest } from './manifest.js'

let tmpDir: string

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vpack-manifest-test-'))
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const p = join(tmpDir, name)
  writeFileSync(p, content)
  return p
}

const VALID_MANIFEST = `
vpack: "1.0"
name: "@acme/product-vision"
version: "1.0.0"
description: "Test pack"
plugins:
  - kind: source
    use: "@vpack/source-fs"
    path: ./docs
  - kind: chunker
    use: "@vpack/chunker-fixed"
    size: 512
    overlap: 64
  - kind: embedder
    use: "@vpack/embedder-xenova"
    model: Xenova/all-MiniLM-L6-v2
    dimensions: 384
    provider: huggingface
`

describe('readManifest', () => {
  it('parses a valid plugins manifest without throwing', async () => {
    const path = write('valid.yml', VALID_MANIFEST)
    const manifest = await readManifest(path)
    expect(manifest.name).toBe('@acme/product-vision')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.plugins).toHaveLength(3)
  })

  it('throws when sources shorthand is present', async () => {
    const bad = VALID_MANIFEST + `\nsources:\n  - use: "@vpack/source-fs"\n    path: ./docs\n`
    const path = write('sources.yml', bad)
    await expect(readManifest(path)).rejects.toThrow(/deprecated top-level fields/i)
  })

  it('throws when chunk shorthand is present', async () => {
    const bad = VALID_MANIFEST + `\nchunk:\n  strategy: fixed\n  size: 256\n  overlap: 32\n`
    const path = write('chunk.yml', bad)
    await expect(readManifest(path)).rejects.toThrow(/deprecated top-level fields/i)
  })

  it('throws when outputs shorthand is present', async () => {
    const bad = VALID_MANIFEST + `\noutputs:\n  - use: "@vpack/output-mcp"\n`
    const path = write('outputs.yml', bad)
    await expect(readManifest(path)).rejects.toThrow(/deprecated top-level fields/i)
  })

  it('throws when filters shorthand is present', async () => {
    const bad = VALID_MANIFEST + `\nfilters:\n  - "@vpack/transformer-dedup"\n`
    const path = write('filters.yml', bad)
    await expect(readManifest(path)).rejects.toThrow(/deprecated top-level fields/i)
  })

  it('throws on missing required field: name', async () => {
    const bad = VALID_MANIFEST.replace('name: "@acme/product-vision"', '')
    const path = write('no-name.yml', bad)
    await expect(readManifest(path)).rejects.toThrow()
  })

  it('throws on invalid name format (not scoped)', async () => {
    const bad = VALID_MANIFEST.replace('@acme/product-vision', 'product-vision')
    const path = write('bad-name.yml', bad)
    await expect(readManifest(path)).rejects.toThrow()
  })

  it('throws on invalid version (not semver)', async () => {
    const bad = VALID_MANIFEST.replace('version: "1.0.0"', 'version: "v1"')
    const path = write('bad-version.yml', bad)
    await expect(readManifest(path)).rejects.toThrow()
  })

  it('throws on missing chunker plugin', async () => {
    const bad = VALID_MANIFEST.replace(/\n  - kind: chunker[\s\S]+?overlap: 64\n/, '\n')
    const path = write('no-chunker.yml', bad)
    await expect(readManifest(path)).rejects.toThrow()
  })

  it('throws on missing embedder plugin', async () => {
    const bad = VALID_MANIFEST.replace(/\n  - kind: embedder[\s\S]+?provider: huggingface\n/, '\n')
    const path = write('no-embedder.yml', bad)
    await expect(readManifest(path)).rejects.toThrow()
  })

  it('throws when embed block is present', async () => {
    const bad = VALID_MANIFEST + `\nembed:\n  model: test\n`
    const path = write('embed-block.yml', bad)
    await expect(readManifest(path)).rejects.toThrow(/deprecated top-level fields/i)
  })

  it('throws when file does not exist', async () => {
    await expect(readManifest('/nonexistent/path/vpack.yml')).rejects.toThrow()
  })
})
