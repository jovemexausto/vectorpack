import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadPlugin } from './plugin-loader.js'

let tmpRoot: string

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'vpack-workspace-'))
  const pluginDir = join(tmpRoot, 'packages', 'plugins', 'source-fixture', 'dist')
  mkdirSync(pluginDir, { recursive: true })
  writeFileSync(
    join(pluginDir, 'index.js'),
    "export default { ok: true };\n",
  )
  process.env['VPACK_WORKSPACE_ROOT'] = tmpRoot
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
  delete process.env['VPACK_WORKSPACE_ROOT']
})

describe('plugin loader', () => {
  it('loads workspace source plugins when VPACK_WORKSPACE_ROOT is set', async () => {
    const mod = await loadPlugin<{ ok: boolean }>('@vpack/source-fixture')
    expect(mod.ok).toBe(true)
  })
})
