import type {
  VPackEngineAdapter,
  VPackIndex,
  EmbeddedChunk,
  PackManifest,
  QueryOptions,
  QueryResult,
  BuildOptions,
  VPackErrorCode,
} from '@vpack/core'
import { VPackError } from '@vpack/core'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

type NativeIndex = object
type NativeModule = {
  buildIndex: (chunksJson: string, manifestJson: string) => NativeIndex | Error
  serializeIndex: (index: NativeIndex) => Buffer | Error
  deserializeIndex: (bytes: Buffer) => NativeIndex | Error
  embedTextsJson: (configJson: string, textsJson: string) => string | Error
  queryIndex: (index: NativeIndex, vector: number[], optionsJson?: string) => string | Error
  manifestJson: (index: NativeIndex) => string
  chunkCount: (index: NativeIndex) => number
  dimensions: (index: NativeIndex) => number
}

const native = loadNative()

class RustIndex implements VPackIndex {
  private readonly manifestValue: PackManifest
  readonly nativeIndex: NativeIndex

  constructor(nativeIndex: NativeIndex) {
    this.nativeIndex = nativeIndex
    this.manifestValue = JSON.parse(native.manifestJson(nativeIndex)) as PackManifest
  }

  manifest(): PackManifest {
    return this.manifestValue
  }

  chunkCount(): number {
    return native.chunkCount(this.nativeIndex)
  }

  dimensions(): number {
    return native.dimensions(this.nativeIndex)
  }

  async query(input: string | number[], options: QueryOptions = {}): Promise<QueryResult[]> {
    if (typeof input === 'string') {
      throw new Error(
        'RustEngine.query() requires a pre-embedded vector. ' +
          'Use @vpack/client which handles embedding automatically.',
      )
    }

    const optionsJson = options && Object.keys(options).length > 0 ? JSON.stringify(options) : undefined
    const resultJson = native.queryIndex(this.nativeIndex, input, optionsJson)
    if (resultJson instanceof Error) {
      mapNativeError(resultJson)
    }
    if (typeof resultJson !== 'string') {
      throw new Error('RustEngine.query() expected JSON string result')
    }
    try {
      return JSON.parse(resultJson) as QueryResult[]
    } catch (err) {
      mapNativeError(err)
    }
  }
}

export const RustEngine: VPackEngineAdapter = {
  build(
    chunks: EmbeddedChunk[],
    manifest: PackManifest,
    _options: BuildOptions = {},
  ): VPackIndex {
    const nativeIndex = native.buildIndex(JSON.stringify(chunks), JSON.stringify(manifest))
    if (nativeIndex instanceof Error) {
      mapNativeError(nativeIndex)
    }
    return new RustIndex(nativeIndex)
  },

  serialize(index: VPackIndex): Uint8Array {
    const bytes = native.serializeIndex(requireNativeIndex(index))
    if (bytes instanceof Error) {
      mapNativeError(bytes)
    }
    return new Uint8Array(bytes)
  },

  deserialize(bytes: Uint8Array): VPackIndex {
    const nativeIndex = native.deserializeIndex(Buffer.from(bytes))
    if (nativeIndex instanceof Error) {
      mapNativeError(nativeIndex)
    }
    return new RustIndex(nativeIndex)
  },
}

export async function embedTexts(
  texts: string[],
  config: Record<string, unknown>,
): Promise<number[][]> {
  const result = native.embedTextsJson(JSON.stringify(config), JSON.stringify(texts))
  if (result instanceof Error) {
    mapNativeError(result)
  }
  if (typeof result !== 'string') {
    throw new Error('RustEngine.embedTexts() expected JSON string result')
  }
  try {
    return JSON.parse(result) as number[][]
  } catch (err) {
    mapNativeError(err)
  }
}

function loadNative(): NativeModule {
  const require = createRequire(__filename)
  const nativePath = resolve(__dirname, '../native/index.node')
  try {
    return require(nativePath) as NativeModule
  } catch (err) {
    throw new Error(
      `Rust engine native addon not found at ${nativePath}. ` +
        'Run `pnpm --filter @vpack/engine build` to compile it.',
    )
  }
}

function mapNativeError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)
  const separatorIndex = message.indexOf('|')
  if (separatorIndex !== -1) {
    const code = message.slice(0, separatorIndex) as VPackErrorCode
    const detail = message.slice(separatorIndex + 1)
    if (isVPackErrorCode(code)) {
      throw new VPackError(code, detail)
    }
  }
  throw err
}

function requireNativeIndex(index: VPackIndex): NativeIndex {
  if (index instanceof RustIndex) {
    return (index as RustIndex).nativeIndex
  }
  throw new Error('RustEngine received a non-Rust index instance')
}

function isVPackErrorCode(code: string): code is VPackErrorCode {
  return (
    code === 'DIMENSION_MISMATCH' ||
    code === 'MODEL_MISMATCH' ||
    code === 'EMPTY_INDEX' ||
    code === 'UNKNOWN_MODEL' ||
    code === 'SERIALIZE_FAILED' ||
    code === 'DESERIALIZE_FAILED' ||
    code === 'MODEL_HASH_MISMATCH'
  )
}
