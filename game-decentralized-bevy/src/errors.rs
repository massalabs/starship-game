use thiserror::Error;

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("Unparsable value from key `{0}`")]
    UnparsableKeyValueJsValue(String),
    #[error("Missing operation key")]
    MissingOperationKey,
    #[error("unknown data store error")]
    UnknownOperationReceived,
}
