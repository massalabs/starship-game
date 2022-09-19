use crate::entities::CollectibleToken;

#[derive(Debug, Clone)]
pub enum GameStatus {
    MassaConnected,
    ServerStreamingStarted,
    PlayerRegistered,
    Started,
    Quit,
    Error(String),
}

#[derive(Debug, Clone)]
pub enum UpdateState {
    Collectibles(Vec<CollectibleToken>),
}
