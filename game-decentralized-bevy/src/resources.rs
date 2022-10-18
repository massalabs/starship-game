use bevy::{prelude::*, utils::HashMap};
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub struct GameTextures {
    pub player: HashMap<usize, Handle<Image>>,
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
    pub name: String,
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
    PlayerRemoved(RemoteGamePlayerState), //uuid
    PlayerMoved(RemoteGamePlayerState),
    TokenCollected((String, String)), // token uuid - player uuid
    TokenAdded(RemoteCollectibleState),
    TokenRemoved(RemoteCollectibleState), // uuid
}

#[derive(Clone)]
pub struct RemoteGameState {
    pub entity_players: BTreeMap<String, Entity>, // uuid - game entity
    pub entity_collectibles: BTreeMap<String, Entity>, // uuid - game entity
    pub remote_players: BTreeMap<String, RemoteGamePlayerState>, //uuid - state mapping
    pub remote_collectibles: BTreeMap<String, RemoteCollectibleState>, //uuid - state mapping
}

impl RemoteGameState {
    pub fn add_new_player(
        &mut self,
        uuid: &str,
        player: RemoteGamePlayerState,
    ) -> Option<RemoteGamePlayerState> {
        self.remote_players.insert(uuid.to_owned(), player)
    }

    pub fn add_new_player_entity(
        &mut self,
        uuid: &str,
        entity: Entity,
    ) -> Option<Entity> {
        self.entity_players.insert(uuid.to_owned(), entity)
    }

    pub fn get_player_entity(
        &self,
        uuid: &str,
    ) -> Option<&Entity> {
        self.entity_players.get(uuid)
    }

    pub fn remove_player(
        &mut self,
        uuid: &str,
    ) {
        self.remote_players.remove(uuid);
        self.entity_players.remove(uuid);
    }

    pub fn clear_players(&mut self) {
        self.remote_players.clear();
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
}

impl Default for RemoteGameState {
    fn default() -> Self {
        Self {
            entity_players: BTreeMap::new(),
            entity_collectibles: BTreeMap::new(),
            remote_players: BTreeMap::new(),
            remote_collectibles: BTreeMap::new(),
        }
    }
}
