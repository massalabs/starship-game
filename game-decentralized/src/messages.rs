use crate::entities::{CollectibleToken, PlayerEntityOnchain, PlayerState};

#[derive(Debug, Clone)]
pub enum ExecutorToGameMessage {
    MassaConnected,
    ServerStreamingStarted,
    PlayerRegistered,
    Started,
    Error(String),
}

#[derive(Debug, Clone)]
pub enum GameToExecutorMessage {
    PlayerVirtuallyMoved(PlayerState),
    Quit,
}

#[derive(Debug, Clone)]
pub enum OnchainUpdateMessage {
    CollectiblesNewState(Vec<CollectibleToken>),
    PlayerMovedOnchain(Vec<PlayerEntityOnchain>),
    PlayerAddedOnchain(Vec<PlayerEntityOnchain>),
    TokenCollectedOnchain(Vec<(String, String)>),
}
