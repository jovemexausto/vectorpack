use crate::error::VPackError;
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

static EMBEDDERS: Lazy<Mutex<HashMap<String, TextEmbedding>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Deserialize)]
pub struct FastembedConfig {
    pub model: String,
    pub dimensions: Option<usize>,
    pub provider: Option<String>,
    pub batch_size: Option<usize>,
    pub max_length: Option<usize>,
}

pub fn embed_texts(config: Value, texts: Vec<String>) -> Result<Vec<Vec<f32>>, VPackError> {
    let config: FastembedConfig = serde_json::from_value(config)
        .map_err(|err| VPackError::UnknownModel(err.to_string()))?;

    if let Some(provider) = &config.provider {
        if provider != "fastembed" {
            return Err(VPackError::UnknownModel(format!(
                "Embedding provider '{}' is not supported by fastembed",
                provider
            )));
        }
    }

    let model = resolve_model(&config.model)?;
    let mut guard = get_or_init_embedder(&config.model, model, config.max_length)?;
    let embedder = guard
        .get_mut(&config.model)
        .ok_or_else(|| VPackError::UnknownModel("embedder cache missing".to_string()))?;

    let batch_size = config.batch_size.unwrap_or(64).max(1);
    let mut vectors: Vec<Vec<f32>> = Vec::with_capacity(texts.len());

    for batch in texts.chunks(batch_size) {
        let batch_vecs = embedder
            .embed(batch.to_vec(), Some(batch_size))
            .map_err(|err| VPackError::UnknownModel(err.to_string()))?;
        vectors.extend(batch_vecs);
    }

    if let Some(expected) = config.dimensions {
        if let Some(first) = vectors.first() {
            if first.len() != expected {
                return Err(VPackError::DimensionMismatch {
                    expected,
                    got: first.len(),
                });
            }
        }
    }

    Ok(vectors)
}

fn get_or_init_embedder(
    key: &str,
    model: EmbeddingModel,
    max_length: Option<usize>,
) -> Result<std::sync::MutexGuard<'static, HashMap<String, TextEmbedding>>, VPackError> {
    let mut guard = EMBEDDERS
        .lock()
        .map_err(|_| VPackError::UnknownModel("embedder cache lock poisoned".to_string()))?;
    if !guard.contains_key(key) {
        let mut options = TextInitOptions::new(model);
        if let Some(max_len) = max_length {
            options = options.with_max_length(max_len);
        }
        let embedder = TextEmbedding::try_new(options)
            .map_err(|err| VPackError::UnknownModel(err.to_string()))?;
        guard.insert(key.to_string(), embedder);
    }
    Ok(guard)
}

fn resolve_model(model_id: &str) -> Result<EmbeddingModel, VPackError> {
    let model = match model_id {
        "sentence-transformers/all-MiniLM-L6-v2" => EmbeddingModel::AllMiniLML6V2,
        "sentence-transformers/all-MiniLM-L12-v2" => EmbeddingModel::AllMiniLML12V2,
        "sentence-transformers/all-mpnet-base-v2" => EmbeddingModel::AllMpnetBaseV2,
        "BAAI/bge-small-en-v1.5" => EmbeddingModel::BGESmallENV15,
        "BAAI/bge-base-en-v1.5" => EmbeddingModel::BGEBaseENV15,
        "BAAI/bge-large-en-v1.5" => EmbeddingModel::BGELargeENV15,
        "BAAI/bge-small-zh-v1.5" => EmbeddingModel::BGESmallZHV15,
        "BAAI/bge-large-zh-v1.5" => EmbeddingModel::BGELargeZHV15,
        "BAAI/bge-m3" => EmbeddingModel::BGEM3,
        _ => {
            return Err(VPackError::UnknownModel(format!(
                "Unknown fastembed model '{model_id}'"
            )))
        }
    };
    Ok(model)
}
