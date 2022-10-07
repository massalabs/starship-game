use bevy::prelude::*;
use std::collections::BTreeMap;

use crate::components::PlayerType;

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
pub struct GamePlayerState {
    pub r#type: PlayerType,
    pub uuid: String,
    pub address: String,
    /// linear speed in meters per second
    pub movement_speed: Vec2,
    /// rotation speed in radians per second
    pub rotation_speed: Quat,
}

#[derive(Clone, Debug)]
pub struct CollectibleState {
    pub uuid: String,
    /// position of the token
    pub position: Vec2,
}

#[derive(Clone)]
pub struct GameState {
    pub local_player: GamePlayerState,
    pub remote_players: BTreeMap<String, GamePlayerState>,
    pub remote_collectibles: BTreeMap<String, CollectibleState>,
}

impl GameState {
    fn add_new_player(
        &mut self,
        uuid: String,
        player: GamePlayerState,
    ) -> Option<GamePlayerState> {
        self.remote_players.insert(uuid, player)
    }

    fn remove_player(
        &mut self,
        uuid: String,
    ) -> Option<GamePlayerState> {
        self.remote_players.remove(&uuid)
    }

    fn add_new_collectible(
        &mut self,
        uuid: String,
        coll: CollectibleState,
    ) -> Option<CollectibleState> {
        self.remote_collectibles.insert(uuid, coll)
    }

    fn remove_collectible(
        &mut self,
        uuid: String,
    ) -> Option<CollectibleState> {
        self.remote_collectibles.remove(&uuid)
    }
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            local_player: GamePlayerState {
                uuid: "".to_owned(),
                address: "".to_owned(),
                movement_speed: Vec2::ZERO,
                rotation_speed: Quat::NAN,
                r#type: PlayerType::Local,
            },
            remote_players: BTreeMap::new(),
            remote_collectibles: BTreeMap::new(),
        }
    }
}
