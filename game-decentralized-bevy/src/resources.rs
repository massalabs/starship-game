use bevy::{
    prelude::*,
    utils::{HashMap, HashSet},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use wasm_bindgen::JsValue;

use crate::events::PlayerLaserSerializedData;

#[derive(Debug, Clone)]
pub struct GameTextures {
    pub player: HashMap<String, Handle<Image>>,
    pub laser: Handle<Image>,
    pub collectible: Handle<Image>,
    pub background: Handle<Image>,
    pub explosion: Handle<TextureAtlas>,
}

#[derive(Debug, Clone)]
pub struct WinSize {
    pub w: f32,
    pub h: f32,
}

#[derive(Clone, Debug)]
pub enum EntityType {
    Local,
    Remote,
}

#[derive(Clone, Debug)]
pub struct RemoteGamePlayerState {
    pub uuid: String,
    pub address: String,
    pub name: String,
    /// linear speed in meters per second
    pub position: Vec3,
    /// rotation speed in radians per second
    pub rotation: Quat,
    pub r#type: EntityType,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteLaserState {
    pub player_uuid: String,
    pub uuid: String,
    pub x: f64,
    pub y: f64,
    pub xx: f64,
    pub yy: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectedEntity {
    pub uuid: String,
    pub player_uuid: String,
    pub value: f64,
    pub time: f64,
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
    PlayerRemoved(RemoteGamePlayerState),
    PlayerMoved(RemoteGamePlayerState),
    TokenCollected(CollectedEntity),
    TokenAdded(RemoteCollectibleState),
    TokenRemoved(RemoteCollectibleState),
    LasersShot((String, Vec<PlayerLaserSerializedData>)), // player_uuid - vec<PlayerLaserSerializedData>
}

#[derive(Clone)]
pub struct RemoteGameState {
    pub entity_player_tags: BTreeMap<String, Entity>, // [player uuid : animation entity]  - both local and remote

    pub entity_players: BTreeMap<String, Entity>, // [player uuid : entity uuid]  - both local and remote
    pub remote_players: BTreeMap<String, RemoteGamePlayerState>, // [player uuid - state mapping]

    pub entity_collectibles: BTreeMap<String, Entity>, // [player uuid : entity uuid]  - both local and remote
    pub remote_collectibles: BTreeMap<String, RemoteCollectibleState>, // [player uuid - state mapping]

    pub entity_lasers: BTreeMap<String, HashSet<Entity>>, // [player uuid : laser entity] - both local and remote
    pub remote_lasers: BTreeMap<String, BTreeMap<String, RemoteLaserState>>, // [player uuid - [laser uuid: laser state mapping]]
}

impl RemoteGameState {
    pub fn add_new_remote_player(
        &mut self,
        uuid: &str,
        player: RemoteGamePlayerState,
    ) -> Option<RemoteGamePlayerState> {
        self.remote_players.insert(uuid.to_owned(), player)
    }

    pub fn add_new_remote_player_entity(
        &mut self,
        uuid: &str,
        entity: Entity,
    ) -> Option<Entity> {
        self.entity_players.insert(uuid.to_owned(), entity)
    }

    pub fn get_remote_player_entity(
        &self,
        uuid: &str,
    ) -> Option<&Entity> {
        self.entity_players.get(uuid)
    }

    pub fn remove_remote_player(
        &mut self,
        uuid: &str,
    ) {
        self.remote_players.remove(uuid);
        self.entity_players.remove(uuid);
        self.entity_player_tags.remove(uuid);
    }

    pub fn clear_remote_players(&mut self) {
        self.remote_players.clear();
    }

    pub fn get_remote_players_count(&self) -> usize {
        self.remote_players.len()
    }

    pub fn get_entity_players_count(&self) -> usize {
        self.entity_players.len()
    }

    // ----------------------------------------

    pub fn add_new_collectible(
        &mut self,
        uuid: &str,
        coll: RemoteCollectibleState,
    ) -> Option<RemoteCollectibleState> {
        self.remote_collectibles.insert(uuid.to_owned(), coll)
    }

    pub fn add_new_collectible_entity(
        &mut self,
        uuid: &str,
        entity: Entity,
    ) -> Option<Entity> {
        self.entity_collectibles.insert(uuid.to_owned(), entity)
    }

    pub fn remove_collectible(
        &mut self,
        uuid: &str,
    ) {
        self.remote_collectibles.remove(uuid);
        self.entity_collectibles.remove(uuid);
    }

    pub fn get_collectible_entity(
        &self,
        uuid: &str,
    ) -> Option<&Entity> {
        self.entity_collectibles.get(uuid)
    }

    pub fn clear_collectibles(&mut self) {
        self.remote_collectibles.clear();
    }
    // ----------------------------------------------
    pub fn add_new_player_tag(
        &mut self,
        uuid: &str,
        entity: Entity,
    ) -> Option<Entity> {
        self.entity_player_tags.insert(uuid.to_owned(), entity)
    }

    pub fn get_player_tag_entity(
        &self,
        uuid: &str,
    ) -> Option<&Entity> {
        self.entity_player_tags.get(uuid)
    }
}

impl Default for RemoteGameState {
    fn default() -> Self {
        Self {
            entity_lasers: BTreeMap::new(),
            entity_players: BTreeMap::new(),
            entity_collectibles: BTreeMap::new(),
            entity_player_tags: BTreeMap::new(),
            remote_players: BTreeMap::new(),
            remote_collectibles: BTreeMap::new(),
            remote_lasers: Default::default(),
        }
    }
}
