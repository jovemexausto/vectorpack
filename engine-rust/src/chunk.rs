use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkMetadata {
    pub source_plugin: String,
    pub source_id: String,
    pub source_url: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub pack_name: String,
    pub chunker_plugin: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    /// Deterministic ID: sha256(source_id + char_offset)
    pub id: String,
    /// Original text, preserved verbatim
    pub text: String,
    pub metadata: ChunkMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddedChunk {
    #[serde(flatten)]
    pub chunk: Chunk,
    /// f32 embedding vector — length must equal index dimensions
    pub vector: Vec<f32>,
}
