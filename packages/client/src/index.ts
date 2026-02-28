import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { engine } from '@vpack/engine'
import type {
  QueryOptions,
  QueryResult,
  PackManifest,
  BuildContext,
  VPackEmbedder,
  VPackPluginConfig,
} from '@vpack/core'
import { loadPlugin } from './plugin-loader.js'

export interface Embedder {
  (text: string, config: Record<string, unknown>, ctx: BuildContext): Promise<number[]>
}

export interface LoadOptions {
  embed?: Embedder
}

export interface KnowledgeBase {
  manifest(): PackManifest
  query(text: string, options?: QueryOptions): Promise<QueryResult[]>
}

function isRegistryRef(source: string): boolean {
  return /^@[^/]+\/[^:]+:.+/.test(source)
}

function pluginConfig(def: VPackPluginConfig): Record<string, unknown> {
  const { kind, use, stage, ...rest } = def
  return rest
}

export async function load(source: string, options: LoadOptions = {}): Promise<KnowledgeBase> {
  if (isRegistryRef(source)) {
    throw new Error('Registry references are not supported yet. Provide a local .vpack path.')
  }

  const bytes = readFileSync(source)
  const index = engine.deserialize(new Uint8Array(bytes))
  const manifest = index.manifest()

  const embedderDef = manifest.plugins.find((p) => p.kind === 'embedder')
  if (!embedderDef) {
    throw new Error('Manifest is missing an embedder plugin.')
  }

  const ctx: BuildContext = {
    manifest,
    changedChunkIds: new Set<string>(),
    buildId: randomUUID(),
    dryRun: false,
  }

  const embedderConfig = pluginConfig(embedderDef)
  const embedderPlugin = options.embed
    ? null
    : await loadPlugin<VPackEmbedder>(embedderDef.use)
  const expectedDims = typeof embedderDef['dimensions'] === 'number' ? embedderDef['dimensions'] : undefined

  const embed = options.embed
    ? options.embed
    : async (text: string, config: Record<string, unknown>, context: BuildContext) => {
        const vectors = await embedderPlugin!.embed([text], config, context)
        const vec = vectors[0]
        if (!vec) throw new Error('Failed to embed query text')
        return vec
      }

  return {
    manifest: () => manifest,
    query: async (text: string, opts?: QueryOptions) => {
      const vector = await embed(text, embedderConfig, ctx)
      if (expectedDims !== undefined && vector.length !== expectedDims) {
        throw new Error(`Embedding dimension mismatch: expected ${expectedDims}, got ${vector.length}`)
      }
      return index.query(vector, opts)
    },
  }
}
