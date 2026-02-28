import type {
  PackManifest,
  RawDocument,
  Chunk,
  EmbeddedChunk,
  VPackSource,
  VPackTransformer,
  VPackChunker,
  VPackEmbedder,
  VPackOutput,
  VPackMiddleware,
  BuildContext,
  VPackPluginConfig,
} from '@vpack/core'
import { VPackError } from '@vpack/core'
import { engine, embedTexts } from '@vpack/engine'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { loadPlugin } from './plugin-loader.js'

export interface BuildReporter {
  start(message: string): void
  succeed(message: string): void
  fail(message: string): void
  setText?(message: string): void
  onChunkProgress?(info: { source: string; docs: number; chunks: number }): void
  onEmbedProgress?(info: { current: number; total: number }): void
}

export interface BuildStats {
  outputPath: string
  chunkCount: number
  vectorCount: number
  sizeBytes: number
  sizeMb: number
}

export interface BuildPipelineOptions {
  manifest: PackManifest
  manifestPath: string
  output: string
  cache?: boolean
  reporter?: BuildReporter
}

type LoadedPlugin<T> = {
  def: VPackPluginConfig
  config: Record<string, unknown>
  plugin: T
}

const noopReporter: BuildReporter = {
  start: () => {},
  succeed: () => {},
  fail: () => {},
}

function pluginConfig(def: VPackPluginConfig): Record<string, unknown> {
  const { kind, use, stage, ...rest } = def
  return rest
}

function isRawDocument(item: RawDocument | Chunk): item is RawDocument {
  return (item as RawDocument).content !== undefined
}

function ensureChunkMetadata(
  chunk: Chunk,
  doc: RawDocument,
  manifest: PackManifest,
  sourcePlugin: string,
  chunkerPlugin: string,
): Chunk {
  const metadata = {
    ...(chunk.metadata ?? {}),
    source_plugin: chunk.metadata?.source_plugin ?? sourcePlugin,
    source_id: chunk.metadata?.source_id ?? doc.id,
    pack_name: chunk.metadata?.pack_name ?? manifest.name,
    chunker_plugin: chunk.metadata?.chunker_plugin ?? chunkerPlugin,
  }

  return { ...chunk, metadata }
}

function transformerStage(
  def: VPackPluginConfig,
  index: number,
  chunkerIndex: number,
): 'pre' | 'post' {
  if (def.stage === 'pre-chunk') return 'pre'
  if (def.stage === 'post-chunk') return 'post'
  return index < chunkerIndex ? 'pre' : 'post'
}

export async function buildPack(options: BuildPipelineOptions): Promise<BuildStats> {
  const { manifest, output, manifestPath } = options
  const reporter = options.reporter ?? noopReporter

  const buildId = randomUUID()
  const ctx: BuildContext = {
    manifest,
    changedChunkIds: new Set<string>(),
    buildId,
    dryRun: false,
  }

  const manifestDir = dirname(resolve(manifestPath))

  const plugins = manifest.plugins
  const chunkerIndex = plugins.findIndex((p: VPackPluginConfig) => p.kind === 'chunker')
  if (chunkerIndex === -1) {
    throw new Error('Invalid manifest: missing chunker plugin')
  }

  const sourceDefs = plugins.filter((p: VPackPluginConfig) => p.kind === 'source')
  const chunkerDef = plugins[chunkerIndex]
  if (!chunkerDef) {
    throw new Error('Invalid manifest: missing chunker plugin')
  }
  const embedderDef = plugins.find((p: VPackPluginConfig) => p.kind === 'embedder')
  const outputDefs = plugins.filter((p: VPackPluginConfig) => p.kind === 'output')
  const middlewareDefs = plugins.filter((p: VPackPluginConfig) => p.kind === 'middleware')

  if (!embedderDef) {
    throw new Error('Invalid manifest: missing embedder plugin')
  }

  const preTransformers: LoadedPlugin<VPackTransformer>[] = []
  const postTransformers: LoadedPlugin<VPackTransformer>[] = []

  for (const [index, def] of plugins.entries()) {
    if (def.kind !== 'transformer') continue
    const plugin = await loadPlugin<VPackTransformer>(def.use, manifestDir)
    const entry = { def, config: pluginConfig(def), plugin }
    if (transformerStage(def, index, chunkerIndex) === 'pre') {
      preTransformers.push(entry)
    } else {
      postTransformers.push(entry)
    }
  }

  const sourcePlugins = await Promise.all(
    sourceDefs.map(async (def: VPackPluginConfig) => ({
      def,
      config: pluginConfig(def),
      plugin: await loadPlugin<VPackSource>(def.use, manifestDir),
    })),
  )

  const chunker: LoadedPlugin<VPackChunker> = {
    def: chunkerDef,
    config: pluginConfig(chunkerDef),
    plugin: await loadPlugin<VPackChunker>(chunkerDef.use, manifestDir),
  }

  const embedder: LoadedPlugin<VPackEmbedder> = {
    def: embedderDef,
    config: pluginConfig(embedderDef),
    plugin: await loadPlugin<VPackEmbedder>(embedderDef.use, manifestDir),
  }

  const outputs: LoadedPlugin<VPackOutput>[] = await Promise.all(
    outputDefs.map(async (def: VPackPluginConfig) => ({
      def,
      config: pluginConfig(def),
      plugin: await loadPlugin<VPackOutput>(def.use, manifestDir),
    })),
  )

  const middleware: LoadedPlugin<VPackMiddleware>[] = await Promise.all(
    middlewareDefs.map(async (def: VPackPluginConfig) => ({
      def,
      config: pluginConfig(def),
      plugin: await loadPlugin<VPackMiddleware>(def.use, manifestDir),
    })),
  )

  const buildIndex = async (context: BuildContext): Promise<ReturnType<typeof engine.build>> => {
    const chunks: Chunk[] = []
    let docsProcessed = 0
    let chunksProduced = 0

    for (const source of sourcePlugins) {
      reporter.start(`Fetching from ${source.def.use}...`)
      let count = 0

      for await (const doc of source.plugin.fetch(source.config, context)) {
        const chunkStart = chunks.length
        let current: RawDocument | Chunk | null = doc

        for (const transformer of preTransformers) {
          if (!current) break
          if (!isRawDocument(current)) {
            throw new Error(`Pre-chunk transformer '${transformer.def.use}' returned a chunk.`)
          }
          current = await transformer.plugin.transform(current, transformer.config, context)
        }

        if (!current) continue
        if (!isRawDocument(current)) {
          throw new Error(`Chunker '${chunker.def.use}' received a chunk instead of raw document.`)
        }

        const produced = await chunker.plugin.chunk(current, chunker.config, context)
        for (const rawChunk of produced) {
          let chunk = ensureChunkMetadata(rawChunk, current, manifest, source.def.use, chunker.def.use)

          let postCurrent: RawDocument | Chunk | null = chunk
          for (const transformer of postTransformers) {
            if (!postCurrent) break
            if (isRawDocument(postCurrent)) {
              throw new Error(`Post-chunk transformer '${transformer.def.use}' returned a raw document.`)
            }
            postCurrent = await transformer.plugin.transform(postCurrent, transformer.config, context)
          }

          if (postCurrent && !isRawDocument(postCurrent)) {
            chunks.push(postCurrent)
          }
        }

        count++
        reporter.setText?.(`Fetching from ${source.def.use}... ${count} docs`)

        docsProcessed += 1
        chunksProduced += chunks.length - chunkStart
        reporter.onChunkProgress?.({
          source: source.def.use,
          docs: docsProcessed,
          chunks: chunksProduced,
        })
      }

      reporter.succeed(`Fetched ${count} documents from ${source.def.use}`)
    }

    reporter.start(`Embedding with ${embedder.def.use}...`)
    const texts = chunks.map((c) => c.text)
    const vectors = await embedWithFallback(texts, embedder, context)
    const dims = embedder.plugin.dimensions(embedder.config)

    if (vectors.length !== chunks.length) {
      throw new Error(`Embedding output count mismatch: got ${vectors.length}, expected ${chunks.length}`)
    }

    const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, i) => {
      const vector = vectors[i]
      if (!vector) throw new Error('Missing embedding vector')
      if (vector.length !== dims) {
        throw new Error(`Embedding dimension mismatch: expected ${dims}, got ${vector.length}`)
      }
      const current = i + 1
      if (current % 25 === 0 || current === chunks.length) {
        reporter.onEmbedProgress?.({ current, total: chunks.length })
      }
      return { ...chunk, vector }
    })

    reporter.succeed(`Embedded ${embeddedChunks.length} chunks`)

    reporter.start('Building HNSW index...')
    const index = engine.build(embeddedChunks, manifest)
    reporter.succeed(`Built HNSW index (${index.chunkCount()} vectors, ${index.dimensions()}d)`)
    return index
  }

  let pipeline = buildIndex
  for (const entry of [...middleware].reverse()) {
    pipeline = entry.plugin.wrap(pipeline, entry.config)
  }

  const index = await pipeline(ctx)

  if (outputs.length > 0) {
    for (const outputPlugin of outputs) {
      reporter.start(`Running output ${outputPlugin.def.use}...`)
      await outputPlugin.plugin.push(index, outputPlugin.config, ctx)
      reporter.succeed(`Output ${outputPlugin.def.use} done`)
    }
  }

  reporter.start('Serializing artifact...')
  const bytes = engine.serialize(index)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, bytes)
  const sizeMb = Number((bytes.length / 1024 / 1024).toFixed(1))
  reporter.succeed(`Serialized → ${sizeMb} MB`)

  return {
    outputPath: output,
    chunkCount: index.chunkCount(),
    vectorCount: index.chunkCount(),
    sizeBytes: bytes.length,
    sizeMb,
  }
}

async function embedWithFallback(
  texts: string[],
  embedder: LoadedPlugin<VPackEmbedder>,
  context: BuildContext,
): Promise<number[][]> {
  try {
    return await embedTexts(texts, embedder.config)
  } catch (err) {
    if (shouldFallbackToTs(err)) {
      return embedder.plugin.embed(texts, embedder.config, context)
    }
    throw err
  }
}

function shouldFallbackToTs(err: unknown): boolean {
  if (err instanceof VPackError && err.code === 'UNKNOWN_MODEL') {
    return true
  }
  if (err instanceof Error) {
    return /embed|model|fastembed|handler/i.test(err.message)
  }
  return false
}
