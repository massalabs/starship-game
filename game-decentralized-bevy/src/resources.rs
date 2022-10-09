use bevy::prelude::*;
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub struct GameTextures {
    pub player: Handle<Image>,
    pub collectible: Handle<Image>,
    pub background: Handle<Image>,
}

#[derive(Debug, Clone)]
pub struct WinSize {
    pub w: f32,
    pub h: f32,
}

#[derive(Clone, Debug)]
pub struct RemoteGamePlayerState {
    pub uuid: String,
    pub address: String,
    /// linear speed in meters per second
    pub position: Vec3,
    /// rotation speed in radians per second
    pub rotation: Quat,
}

#[derive(Clone, Debug)]
pub struct RemoteCollectibleState {
    pub uuid: String,
    /// position of the token
    pub position: Vec3,
}

#[derive(Clone, Debug)]
pub enum RemoteStateType {
    PlayerAdded(RemoteGamePlayerState),
    PlayerRemoved(String),
    PlayerMoved(RemoteGamePlayerState),
    TokenCollected((String, String)),
    GameTokensUpdated(Vec<RemoteCollectibleState>)
}

#[derive(Clone)]
pub struct RemoteGameState {
    pub remote_players: BTreeMap<String, RemoteGamePlayerState>, //uuid - state mapping
    pub remote_collectibles: BTreeMap<String, RemoteCollectibleState>, //uuid - state mapping
}

impl RemoteGameState {
    fn add_new_player(
        &mut self,
        uuid: String,
        player: RemoteGamePlayerState,
    ) -> Option<RemoteGamePlayerState> {
        self.remote_players.insert(uuid, player)
    }

    fn remove_player(
        &mut self,
        uuid: String,
    ) -> Option<RemoteGamePlayerState> {
        self.remote_players.remove(&uuid)
    }

    fn add_new_collectible(
        &mut self,
        uuid: String,
        coll: RemoteCollectibleState,
    ) -> Option<RemoteCollectibleState> {
        self.remote_collectibles.insert(uuid, coll)
    }

    fn remove_collectible(
        &mut self,
        uuid: String,
    ) -> Option<RemoteCollectibleState> {
        self.remote_collectibles.remove(&uuid)
    }
}

impl Default for RemoteGameState {
    fn default() -> Self {
        Self {
            remote_players: BTreeMap::new(),
            remote_collectibles: BTreeMap::new(),
        }
    }
}
