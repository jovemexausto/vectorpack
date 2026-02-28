import { readFileSync } from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import type { PackManifest } from '@vpack/core'
import { parseManifest } from '@vpack/core'

export async function readManifest(path: string): Promise<PackManifest> {
  const raw = readFileSync(path, 'utf-8')
  const parsed = yamlLoad(raw)
  return parseManifest(parsed)
}
