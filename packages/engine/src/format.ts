// format.ts — .vpack binary serialization
//
// Phase 1: JSON-in-a-Uint8Array. Functional but not space-efficient.
// Phase 2: Replaced by the Rust bincode implementation.
//           The serialize/deserialize signatures stay identical.
//
// Binary layout (Phase 1, simplified):
//   [4 bytes magic: "VPAK"]
//   [1 byte version: 0x01]
//   [4 bytes payload length: u32 LE]
//   [N bytes payload: JSON-encoded SerializedIndex]

import type { VPackIndex, EmbeddedChunk, PackManifest } from '@vpack/core'
import { Errors } from '@vpack/core'

const MAGIC = new Uint8Array([0x56, 0x50, 0x41, 0x4b]) // "VPAK"
const FORMAT_VERSION = 0x01

export interface SerializedIndex {
  version: number
  manifest: PackManifest
  chunks: EmbeddedChunk[]
}

// ── Internal VPackIndex impl used by both serialize and deserialize ───────────
// Kept here to avoid circular imports with ts-engine.ts

class RestoredIndex implements VPackIndex {
  constructor(
    readonly chunks: EmbeddedChunk[],
    private readonly _manifest: PackManifest,
  ) {}

  manifest(): PackManifest {
    return this._manifest
  }

  chunkCount(): number {
    return this.chunks.length
  }

  dimensions(): number {
    return getEmbedderDimensions(this._manifest)
  }

  async query(input: string | number[]): Promise<never> {
    // Deserialized index delegates query back to the engine — this is intentional.
    // Load via engine.deserialize() which returns a proper TsVPackIndex.
    void input
    throw Errors.emptyIndex() // will be replaced by proper re-hydration below
  }
}

export function serialize(index: VPackIndex): Uint8Array {
  const payload: SerializedIndex = {
    version: FORMAT_VERSION,
    manifest: index.manifest(),
    chunks: (index as unknown as { chunks: EmbeddedChunk[] }).chunks ?? [],
  }

  const json = JSON.stringify(payload)
  const payloadBytes = new TextEncoder().encode(json)
  const payloadLength = payloadBytes.length

  // Header: 4 (magic) + 1 (version) + 4 (length) = 9 bytes
  const buf = new Uint8Array(9 + payloadLength)
  buf.set(MAGIC, 0)
  buf[4] = FORMAT_VERSION
  new DataView(buf.buffer).setUint32(5, payloadLength, true)
  buf.set(payloadBytes, 9)

  return buf
}

export function deserializePayload(bytes: Uint8Array): SerializedIndex {
  if (bytes.length < 9) throw new Error('Invalid .vpack file: too short')

  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('Invalid .vpack file: bad magic bytes')
  }

  const version = bytes[4]
  if (version !== FORMAT_VERSION) {
    throw new Error(`Unsupported .vpack format version: 0x${version?.toString(16)}`)
  }

  const payloadLength = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5, true)
  const payloadBytes = bytes.slice(9, 9 + payloadLength)
  const json = new TextDecoder().decode(payloadBytes)
  return JSON.parse(json) as SerializedIndex
}

export function deserialize(bytes: Uint8Array): VPackIndex {
  // Returns a RestoredIndex with metadata access.
  // For full query capability, the engine re-builds using the chunks.
  // This two-step approach avoids circular deps and matches Phase 2 Rust behaviour.
  const payload = deserializePayload(bytes)
  return new RestoredIndex(payload.chunks, payload.manifest)
}

function getEmbedderDimensions(manifest: PackManifest): number {
  const embedder = manifest.plugins.find((p) => p.kind === 'embedder')
  const dims = embedder?.['dimensions']
  if (typeof dims !== 'number') {
    throw new Error('Embedder plugin config must include dimensions')
  }
  return dims
}
