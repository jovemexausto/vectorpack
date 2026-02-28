use serde_json::json;
use vpack_engine::{Chunk, ChunkMetadata, EmbeddedChunk, QueryOptions, VPackIndex};
use std::collections::HashMap;

fn make_manifest(dimensions: usize) -> serde_json::Value {
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

fn make_chunk(id: &str, vector: Vec<f32>, text: &str) -> EmbeddedChunk {
    EmbeddedChunk {
        chunk: Chunk {
            id: id.to_string(),
            text: text.to_string(),
            metadata: ChunkMetadata {
                source_plugin: "@vpack/source-fs".to_string(),
                source_id: id.to_string(),
                source_url: None,
                created_at: None,
                updated_at: None,
                pack_name: "@test/fixture".to_string(),
                chunker_plugin: "@vpack/chunker-fixed".to_string(),
                extra: HashMap::new(),
            },
        },
        vector,
    }
}

fn chunks_3d() -> Vec<EmbeddedChunk> {
    vec![
        make_chunk("pricing", vec![1.0, 0.0, 0.0], "Pricing should reflect value delivered"),
        make_chunk("deployment", vec![0.0, 1.0, 0.0], "Deploy using blue-green strategy"),
        make_chunk("culture", vec![0.0, 0.0, 1.0], "We value radical candor and async work"),
    ]
}

#[test]
fn build_and_query_basic() {
    let index = VPackIndex::build(chunks_3d(), make_manifest(3)).unwrap();
    let results = index.query(&[1.0, 0.0, 0.0], QueryOptions::default()).unwrap();
    assert_eq!(results[0].chunk.id, "pricing");
}

#[test]
fn min_score_filters_results() {
    let index = VPackIndex::build(chunks_3d(), make_manifest(3)).unwrap();
    let mut options = QueryOptions::default();
    options.min_score = Some(0.5);
    let results = index.query(&[1.0, 0.0, 0.0], options).unwrap();
    assert_eq!(results.len(), 1);
}

#[test]
fn filter_ops_match() {
    let mut finance = HashMap::new();
    finance.insert("category".to_string(), json!("finance"));
    let mut engineering = HashMap::new();
    engineering.insert("category".to_string(), json!("engineering"));

    let mixed = vec![
        EmbeddedChunk {
            chunk: Chunk {
                id: "a".to_string(),
                text: "a".to_string(),
                metadata: ChunkMetadata {
                    source_plugin: "@vpack/source-fs".to_string(),
                    source_id: "a".to_string(),
                    source_url: None,
                    created_at: None,
                    updated_at: None,
                    pack_name: "test".to_string(),
                    chunker_plugin: "@vpack/chunker-fixed".to_string(),
                    extra: finance,
                },
            },
            vector: vec![1.0, 0.0, 0.0],
        },
        EmbeddedChunk {
            chunk: Chunk {
                id: "b".to_string(),
                text: "b".to_string(),
                metadata: ChunkMetadata {
                    source_plugin: "@vpack/source-notion".to_string(),
                    source_id: "b".to_string(),
                    source_url: None,
                    created_at: None,
                    updated_at: None,
                    pack_name: "test".to_string(),
                    chunker_plugin: "@vpack/chunker-fixed".to_string(),
                    extra: engineering,
                },
            },
            vector: vec![0.9, 0.1, 0.0],
        },
    ];

    let index = VPackIndex::build(mixed, make_manifest(3)).unwrap();

    let mut options = QueryOptions::default();
    options.filter = Some(serde_json::from_value(json!({
        "field": "source_plugin",
        "op": "eq",
        "value": "@vpack/source-fs"
    })).unwrap());
    let results = index.query(&[1.0, 0.0, 0.0], options).unwrap();
    assert_eq!(results.len(), 1);

    let mut options = QueryOptions::default();
    options.filter = Some(serde_json::from_value(json!({
        "field": "category",
        "op": "in",
        "value": ["finance"]
    })).unwrap());
    let results = index.query(&[1.0, 0.0, 0.0], options).unwrap();
    assert_eq!(results.len(), 1);
}

#[test]
fn serialize_round_trip() {
    let index = VPackIndex::build(chunks_3d(), make_manifest(3)).unwrap();
    let bytes = vpack_engine::serialize(&index).unwrap();
    let restored = vpack_engine::deserialize(&bytes).unwrap();
    assert_eq!(restored.chunk_count(), 3);
    assert_eq!(restored.dimensions(), 3);
}

#[test]
fn deserialize_rejects_old_version() {
    let bytes = vec![0x56, 0x50, 0x41, 0x4b, 0x01, 0, 0, 0, 0];
    let result = vpack_engine::deserialize(&bytes);
    assert!(result.is_err());
}
