import { pipeline } from '@xenova/transformers'
import type { VPackEmbedder, BuildContext } from '@vpack/core'

export interface XenovaEmbedderConfig {
  model: string
  model_hash?: string
  dimensions: number
  provider: 'huggingface'
}

type FeatureExtractionOutput = {
  data: Float32Array
  dims: number[]
}

type PipelineFn = (inputs: string | string[]) => Promise<FeatureExtractionOutput | number[] | number[][]>

const pipelineCache = new Map<string, PipelineFn>()

async function getPipeline(modelId: string): Promise<PipelineFn> {
  const cached = pipelineCache.get(modelId)
  if (cached) return cached

  const pipe = (await pipeline('feature-extraction', modelId)) as PipelineFn
  pipelineCache.set(modelId, pipe)
  return pipe
}

function l2Normalize(vec: number[]): number[] {
  let sum = 0
  for (const v of vec) sum += v * v
  const norm = Math.sqrt(sum) || 1
  return vec.map((v) => v / norm)
}

function meanPool(data: Float32Array, tokens: number, dim: number, offset: number): number[] {
  const out = new Array<number>(dim).fill(0)
  for (let t = 0; t < tokens; t++) {
    const base = offset + t * dim
    for (let d = 0; d < dim; d++) {
      const current = out[d] ?? 0
      out[d] = current + (data[base + d] ?? 0)
    }
  }
  for (let d = 0; d < dim; d++) {
    out[d] = (out[d] ?? 0) / tokens
  }
  return out
}

function tensorToVectors(output: FeatureExtractionOutput): number[][] {
  const { data, dims } = output
  if (dims.length === 2) {
    const batch = dims[0]
    const dim = dims[1]
    if (batch === undefined || dim === undefined) {
      throw new Error(`Unexpected embedding tensor shape: [${dims.join(', ')}]`)
    }
    const vectors: number[][] = []
    for (let b = 0; b < batch; b++) {
      const start = b * dim
      const vec = Array.from(data.slice(start, start + dim))
      vectors.push(vec)
    }
    return vectors
  }
  if (dims.length === 3) {
    const batch = dims[0]
    const tokens = dims[1]
    const dim = dims[2]
    if (batch === undefined || tokens === undefined || dim === undefined) {
      throw new Error(`Unexpected embedding tensor shape: [${dims.join(', ')}]`)
    }
    const vectors: number[][] = []
    for (let b = 0; b < batch; b++) {
      const offset = b * tokens * dim
      vectors.push(meanPool(data, tokens, dim, offset))
    }
    return vectors
  }
  throw new Error(`Unexpected embedding tensor shape: [${dims.join(', ')}]`)
}

async function embedTexts(texts: string[], config: XenovaEmbedderConfig): Promise<number[][]> {
  if (texts.length === 0) return []
  if (config.provider !== 'huggingface') {
    throw new Error(`Embedding provider '${config.provider}' is not supported by Xenova embedder.`)
  }

  const pipe = await getPipeline(config.model)
  const output = await pipe(texts)

  let vectors: number[][]
  if (Array.isArray(output)) {
    if (Array.isArray(output[0])) {
      vectors = output as number[][]
    } else {
      vectors = [output as number[]]
    }
  } else {
    vectors = tensorToVectors(output)
  }

  if (vectors.length !== texts.length) {
    throw new Error(`Embedding output count mismatch: got ${vectors.length}, expected ${texts.length}`)
  }

  for (const vec of vectors) {
    if (vec.length !== config.dimensions) {
      throw new Error(`Embedding dimension mismatch: expected ${config.dimensions}, got ${vec.length}`)
    }
  }

  return vectors.map(l2Normalize)
}

export const XenovaEmbedder: VPackEmbedder<XenovaEmbedderConfig> = {
  async embed(texts: string[], config: XenovaEmbedderConfig, _ctx: BuildContext): Promise<number[][]> {
    return embedTexts(texts, config)
  },

  dimensions(config: XenovaEmbedderConfig): number {
    return config.dimensions
  },

  modelId(config: XenovaEmbedderConfig): string {
    return config.model
  },

  async modelHash(config: XenovaEmbedderConfig): Promise<string> {
    return config.model_hash ?? ''
  },
}

export default XenovaEmbedder
