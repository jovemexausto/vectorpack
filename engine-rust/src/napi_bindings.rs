use napi::bindgen_prelude::{Buffer, Result as NapiResult};
use napi::Error;
use napi_derive::napi;

use crate::chunk::EmbeddedChunk;
use crate::embeddings::embed_texts;
use crate::error::VPackError;
use crate::index::VPackIndex;
use crate::query::QueryOptions;
use crate::serialize::{deserialize, serialize};

fn napi_error_from_vpack(err: VPackError) -> Error {
    Error::from_reason(format!("{}|{}", err.code(), err))
}

fn napi_error_from_json(err: serde_json::Error) -> Error {
    Error::from_reason(format!(
        "DESERIALIZE_FAILED|invalid JSON: {err}"
    ))
}

#[napi]
pub struct NativeIndex {
    inner: VPackIndex,
}

#[napi]
pub fn build_index(chunks_json: String, manifest_json: String) -> NapiResult<NativeIndex> {
    let chunks: Vec<EmbeddedChunk> = serde_json::from_str(&chunks_json).map_err(napi_error_from_json)?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest_json).map_err(napi_error_from_json)?;
    let index = VPackIndex::build(chunks, manifest).map_err(napi_error_from_vpack)?;
    Ok(NativeIndex { inner: index })
}

#[napi]
pub fn serialize_index(index: &NativeIndex) -> NapiResult<Buffer> {
    let bytes = serialize(&index.inner).map_err(napi_error_from_vpack)?;
    Ok(Buffer::from(bytes))
}

#[napi]
pub fn deserialize_index(bytes: Buffer) -> NapiResult<NativeIndex> {
    let index = deserialize(bytes.as_ref()).map_err(napi_error_from_vpack)?;
    Ok(NativeIndex { inner: index })
}

#[napi]
pub fn embed_texts_json(config_json: String, texts_json: String) -> NapiResult<String> {
    let config: serde_json::Value = serde_json::from_str(&config_json).map_err(napi_error_from_json)?;
    let texts: Vec<String> = serde_json::from_str(&texts_json).map_err(napi_error_from_json)?;
    let vectors = embed_texts(config, texts).map_err(napi_error_from_vpack)?;
    serde_json::to_string(&vectors).map_err(napi_error_from_json)
}

#[napi]
pub fn query_index(
    index: &NativeIndex,
    vector: Vec<f64>,
    options_json: Option<String>,
) -> NapiResult<String> {
    let vector_f32: Vec<f32> = vector.into_iter().map(|v| v as f32).collect();
    let options = match options_json {
        Some(json) => serde_json::from_str::<QueryOptions>(&json).map_err(napi_error_from_json)?,
        None => QueryOptions::default(),
    };
    let results = index
        .inner
        .query(&vector_f32, options)
        .map_err(napi_error_from_vpack)?;
    serde_json::to_string(&results).map_err(napi_error_from_json)
}

#[napi]
pub fn manifest_json(index: &NativeIndex) -> NapiResult<String> {
    serde_json::to_string(index.inner.manifest()).map_err(napi_error_from_json)
}

#[napi]
pub fn chunk_count(index: &NativeIndex) -> u32 {
    index.inner.chunk_count() as u32
}

#[napi]
pub fn dimensions(index: &NativeIndex) -> u32 {
    index.inner.dimensions() as u32
}
