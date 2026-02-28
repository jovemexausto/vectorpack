use thiserror::Error;

/// All VectorPack error codes, matching RFC-0001 §9.4.
/// ModelMismatch is a hard error — it never silently proceeds.
#[derive(Debug, Error)]
pub enum VPackError {
    #[error("dimension mismatch: index expects {expected}d vectors, query vector is {got}d")]
    DimensionMismatch { expected: usize, got: usize },

    /// Hard error. Silent model mismatch produces valid-looking but meaningless results.
    #[error(
        "model mismatch: index built with '{expected}', query uses '{got}' \
        — results would be meaningless. This is a hard error, not a warning."
    )]
    ModelMismatch { expected: String, got: String },

    #[error("index is empty — call build() before query()")]
    EmptyIndex,

    #[error("model hash mismatch for '{model}': manifest pins {expected}, local weights hash to {got}")]
    ModelHashMismatch {
        model: String,
        expected: String,
        got: String,
    },

    #[error("serialization failed: {0}")]
    Serialize(#[from] bincode::Error),

    #[error("unknown or unsupported model: {0}")]
    UnknownModel(String),

    #[error("invalid .vpack file: {0}")]
    InvalidFormat(String),
}

impl VPackError {
    pub fn code(&self) -> &'static str {
        match self {
            VPackError::DimensionMismatch { .. } => "DIMENSION_MISMATCH",
            VPackError::ModelMismatch { .. } => "MODEL_MISMATCH",
            VPackError::EmptyIndex => "EMPTY_INDEX",
            VPackError::ModelHashMismatch { .. } => "MODEL_HASH_MISMATCH",
            VPackError::Serialize(_) => "SERIALIZE_FAILED",
            VPackError::UnknownModel(_) => "UNKNOWN_MODEL",
            VPackError::InvalidFormat(_) => "DESERIALIZE_FAILED",
        }
    }
}
