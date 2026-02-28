use crate::chunk::EmbeddedChunk;
use crate::error::VPackError;
use crate::math::cosine_similarity;
use crate::query::{matches_filter, QueryOptions, QueryResult};
use serde_json::Value;

/// The in-memory queryable index.
/// Built from EmbeddedChunks by VPackIndex::build().
pub struct VPackIndex {
    pub(crate) chunks: Vec<EmbeddedChunk>,
    pub(crate) dimensions: usize,
    pub(crate) manifest: Value,
    // TODO Phase 2: replace linear scan with HNSW graph from instant-distance
    // pub(crate) hnsw: HnswMap<...>,
}

impl VPackIndex {
    /// Build an index from pre-embedded chunks.
    /// All chunk vectors must have length == dimensions declared by the embedder plugin.
    pub fn build(
        chunks: Vec<EmbeddedChunk>,
        manifest: Value,
    ) -> Result<Self, VPackError> {
        if chunks.is_empty() {
            return Err(VPackError::EmptyIndex);
        }

        let dimensions = get_embedder_dimensions(&manifest)?;

        for chunk in &chunks {
            if chunk.vector.len() != dimensions {
                return Err(VPackError::DimensionMismatch {
                    expected: dimensions,
                    got: chunk.vector.len(),
                });
            }
        }

        Ok(Self {
            chunks,
            dimensions,
            manifest,
        })
    }

    /// Query the index.
    /// query_vector must have length == self.dimensions.
    pub fn query(
        &self,
        query_vector: &[f32],
        options: QueryOptions,
    ) -> Result<Vec<QueryResult>, VPackError> {
        if query_vector.len() != self.dimensions {
            return Err(VPackError::DimensionMismatch {
                expected: self.dimensions,
                got: query_vector.len(),
            });
        }

        // Linear scan — O(n). Replace with HNSW traversal in Phase 2.
        let mut scored: Vec<(f32, usize)> = self
            .chunks
            .iter()
            .enumerate()
            .filter(|(_, chunk)| {
                options
                    .filter
                    .as_ref()
                    .map(|filter| matches_filter(&chunk.chunk, filter))
                    .unwrap_or(true)
            })
            .map(|(i, chunk)| (cosine_similarity(query_vector, &chunk.vector), i))
            .collect();

        // Sort descending by score
        scored.sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        scored
            .iter()
            .filter(|(score, _)| options.min_score.map_or(true, |min| *score >= min))
            .take(options.top_k)
            .enumerate()
            .map(|(rank, (score, idx))| {
                Ok(QueryResult {
                    chunk: self.chunks[*idx].chunk.clone(),
                    score: *score,
                    rank,
                    vector: if options.include_vectors {
                        Some(self.chunks[*idx].vector.clone())
                    } else {
                        None
                    },
                })
            })
            .collect()
    }

    pub fn chunk_count(&self) -> usize {
        self.chunks.len()
    }

    pub fn dimensions(&self) -> usize {
        self.dimensions
    }

    pub fn manifest(&self) -> &Value {
        &self.manifest
    }
}

fn get_embedder_dimensions(manifest: &Value) -> Result<usize, VPackError> {
    let plugins = manifest
        .get("plugins")
        .and_then(|value| value.as_array())
        .ok_or_else(|| VPackError::UnknownModel("Embedder plugin config must include dimensions".to_string()))?;

    for plugin in plugins {
        let kind = plugin.get("kind").and_then(|v| v.as_str());
        if kind == Some("embedder") {
            let dims = plugin.get("dimensions");
            if let Some(dims) = dims.and_then(|v| v.as_u64()) {
                return Ok(dims as usize);
            }
            if let Some(dims) = dims.and_then(|v| v.as_f64()) {
                if dims.fract() == 0.0 {
                    return Ok(dims as usize);
                }
            }
            return Err(VPackError::UnknownModel(
                "Embedder plugin config must include dimensions".to_string(),
            ));
        }
    }

    Err(VPackError::UnknownModel(
        "Embedder plugin config must include dimensions".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chunk::{Chunk, ChunkMetadata, EmbeddedChunk};
    use std::collections::HashMap;
    use serde_json::json;

    fn make_chunk(id: &str, vector: Vec<f32>) -> EmbeddedChunk {
        EmbeddedChunk {
            chunk: Chunk {
                id: id.to_string(),
                text: format!("text for {id}"),
                metadata: ChunkMetadata {
                    source_plugin: "@vpack/source-fs".to_string(),
                    source_id: id.to_string(),
                    source_url: None,
                    created_at: None,
                    updated_at: None,
                    pack_name: "test".to_string(),
                    chunker_plugin: "@vpack/chunker-fixed".to_string(),
                    extra: HashMap::new(),
                },
            },
            vector,
        }
    }

    fn make_manifest(dimensions: usize) -> Value {
        json!({
            "vpack": "1.0",
            "name": "@test/fixture",
            "version": "1.0.0",
            "plugins": [
                { "kind": "source", "use": "@vpack/source-fs", "path": "./docs" },
                { "kind": "chunker", "use": "@vpack/chunker-fixed", "size": 512, "overlap": 64, "min_size": 1 },
                { "kind": "embedder", "use": "@vpack/embedder-xenova", "model": "Xenova/all-MiniLM-L6-v2", "dimensions": dimensions, "provider": "huggingface" }
            ]
        })
    }

    #[test]
    fn build_and_query() {
        let chunks = vec![
            make_chunk("a", vec![1.0, 0.0, 0.0]),
            make_chunk("b", vec![0.0, 1.0, 0.0]),
            make_chunk("c", vec![0.0, 0.0, 1.0]),
        ];

        let index = VPackIndex::build(chunks, make_manifest(3)).unwrap();
        let results = index
            .query(&[1.0, 0.0, 0.0], QueryOptions::default())
            .unwrap();

        assert_eq!(results[0].chunk.id, "a");
        assert!((results[0].score - 1.0).abs() < 1e-6);
    }

    #[test]
    fn build_requires_embedder_dimensions() {
        let chunks = vec![make_chunk("a", vec![1.0, 0.0])];
        let manifest = json!({ "vpack": "1.0", "name": "x", "version": "1.0.0", "plugins": [] });
        let result = VPackIndex::build(chunks, manifest);
        assert!(matches!(result, Err(VPackError::UnknownModel(_))));
    }
}
