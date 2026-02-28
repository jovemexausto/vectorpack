use serde::{Deserialize, Serialize};
use crate::chunk::Chunk;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataFilter {
    /// Dot-notation path into chunk.metadata, e.g. "source_plugin"
    pub field: String,
    pub op: FilterOp,
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOp {
    Eq,
    Neq,
    In,
    Nin,
    Gte,
    Lte,
    Exists,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct QueryOptions {
    pub top_k: usize,
    pub min_score: Option<f32>,
    pub filter: Option<MetadataFilter>,
    pub include_vectors: bool,
}

impl Default for QueryOptions {
    fn default() -> Self {
        Self {
            top_k: 10,
            min_score: None,
            filter: None,
            include_vectors: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult {
    pub chunk: Chunk,
    pub score: f32,
    pub rank: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vector: Option<Vec<f32>>,
}

pub fn matches_filter(chunk: &Chunk, filter: &MetadataFilter) -> bool {
    let meta_value = match serde_json::to_value(&chunk.metadata) {
        Ok(value) => value,
        Err(_) => return false,
    };

    let value = get_nested_value(&meta_value, &filter.field);

    match filter.op {
        FilterOp::Eq => {
            if let Some(expected) = filter.value.as_ref() {
                value.map_or(false, |v| v == expected)
            } else {
                value.is_none()
            }
        }
        FilterOp::Neq => {
            if let Some(expected) = filter.value.as_ref() {
                value.map_or(true, |v| v != expected)
            } else {
                value.is_some()
            }
        }
        FilterOp::In => {
            if let Some(serde_json::Value::Array(values)) = filter.value.as_ref() {
                value.map_or(false, |v| values.iter().any(|item| item == v))
            } else {
                false
            }
        }
        FilterOp::Nin => {
            if let Some(serde_json::Value::Array(values)) = filter.value.as_ref() {
                value.map_or(false, |v| values.iter().all(|item| item != v))
            } else {
                false
            }
        }
        FilterOp::Gte => compare_number(value, filter.value.as_ref(), |a, b| a >= b),
        FilterOp::Lte => compare_number(value, filter.value.as_ref(), |a, b| a <= b),
        FilterOp::Exists => match value {
            Some(serde_json::Value::Null) | None => false,
            Some(_) => true,
        },
    }
}

fn compare_number(
    value: Option<&serde_json::Value>,
    expected: Option<&serde_json::Value>,
    cmp: fn(f64, f64) -> bool,
) -> bool {
    let lhs = value.and_then(|v| v.as_f64());
    let rhs = expected.and_then(|v| v.as_f64());
    match (lhs, rhs) {
        (Some(a), Some(b)) => cmp(a, b),
        _ => false,
    }
}

fn get_nested_value<'a>(value: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut current = value;
    for key in path.split('.') {
        match current {
            serde_json::Value::Object(map) => {
                current = map.get(key)?;
            }
            _ => return None,
        }
    }
    Some(current)
}
