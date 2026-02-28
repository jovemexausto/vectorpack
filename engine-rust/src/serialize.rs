// serialize.rs — .vpack binary format
//
// Phase 1: bincode over a flat struct. Functionally correct.
// Phase 2: columnar layout per RFC-0001 §3.1 with section table,
//          enabling partial reads and streaming query-on-registry.

use crate::chunk::{Chunk, ChunkMetadata, EmbeddedChunk};
use crate::error::VPackError;
use crate::index::VPackIndex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

const MAGIC: &[u8; 4] = b"VPAK";
const FORMAT_VERSION: u8 = 0x02;

#[derive(Serialize, Deserialize)]
struct PackMetadata {
    source_plugin: String,
    source_id: String,
    source_url: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    pack_name: String,
    chunker_plugin: String,
    extra: HashMap<String, Value>,
}

#[derive(Serialize, Deserialize)]
struct PackChunk {
    id: String,
    text: String,
    metadata: PackMetadata,
    vector: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
struct PackPayload {
    manifest_json: String,
    chunks: Vec<PackChunk>,
    // Phase 2: add manifest_hash: [u8; 32] and section table
}

pub fn serialize(index: &VPackIndex) -> Result<Vec<u8>, VPackError> {
    let manifest_json = serde_json::to_string(index.manifest())
        .map_err(|err| VPackError::InvalidFormat(err.to_string()))?;
    let chunks = index
        .chunks
        .iter()
        .map(|embedded| PackChunk {
            id: embedded.chunk.id.clone(),
            text: embedded.chunk.text.clone(),
            metadata: PackMetadata {
                source_plugin: embedded.chunk.metadata.source_plugin.clone(),
                source_id: embedded.chunk.metadata.source_id.clone(),
                source_url: embedded.chunk.metadata.source_url.clone(),
                created_at: embedded.chunk.metadata.created_at.clone(),
                updated_at: embedded.chunk.metadata.updated_at.clone(),
                pack_name: embedded.chunk.metadata.pack_name.clone(),
                chunker_plugin: embedded.chunk.metadata.chunker_plugin.clone(),
                extra: embedded.chunk.metadata.extra.clone(),
            },
            vector: embedded.vector.clone(),
        })
        .collect();

    let pack = PackPayload {
        manifest_json,
        chunks,
    };

    let payload = bincode::serialize(&pack)?;
    let mut buf = Vec::with_capacity(5 + payload.len());
    buf.extend_from_slice(MAGIC);
    buf.push(FORMAT_VERSION);
    buf.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    buf.extend_from_slice(&payload);

    Ok(buf)
}

pub fn deserialize(bytes: &[u8]) -> Result<VPackIndex, VPackError> {
    if bytes.len() < 9 {
        return Err(VPackError::InvalidFormat("file too short".to_string()));
    }

    if &bytes[..4] != MAGIC {
        return Err(VPackError::InvalidFormat("bad magic bytes".to_string()));
    }

    let version = bytes[4];
    if version != FORMAT_VERSION {
        return Err(VPackError::InvalidFormat(format!(
            "unsupported .vpack format version 0x{version:02x} — rebuild with Rust engine",
        )));
    }
    let payload_len = u32::from_le_bytes(bytes[5..9].try_into().unwrap()) as usize;

    if bytes.len() < 9 + payload_len {
        return Err(VPackError::InvalidFormat("truncated payload".to_string()));
    }

    let pack: PackPayload = bincode::deserialize(&bytes[9..9 + payload_len])?;
    let manifest: Value = serde_json::from_str(&pack.manifest_json)
        .map_err(|err| VPackError::InvalidFormat(err.to_string()))?;
    let chunks = pack
        .chunks
        .into_iter()
        .map(|chunk| EmbeddedChunk {
            chunk: Chunk {
                id: chunk.id,
                text: chunk.text,
                metadata: ChunkMetadata {
                    source_plugin: chunk.metadata.source_plugin,
                    source_id: chunk.metadata.source_id,
                    source_url: chunk.metadata.source_url,
                    created_at: chunk.metadata.created_at,
                    updated_at: chunk.metadata.updated_at,
                    pack_name: chunk.metadata.pack_name,
                    chunker_plugin: chunk.metadata.chunker_plugin,
                    extra: chunk.metadata.extra,
                },
            },
            vector: chunk.vector,
        })
        .collect();

    VPackIndex::build(chunks, manifest)
}
