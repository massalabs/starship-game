use crate::entities::{CollectibleToken, PlayerState};

#[derive(Debug, Clone)]
pub enum ExecutorToGameMessage {
    MassaConnected,
    ServerStreamingStarted,
    PlayerRegistered,
    Started,
    Error(String),
}

#[derive(Debug, Clone)]
pub enum UpdateState {
    Collectibles(Vec<CollectibleToken>),
}

#[derive(Debug, Clone)]
pub enum GameToExecutorMessage {
    PlayerVirtuallyMoved(PlayerState),
    Quit,
}
