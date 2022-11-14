use bevy::prelude::{Quat, Vec3};
use serde::{Deserialize, Serialize};
/// Event being sent out when the own player moves
#[derive(Debug)]
pub struct PlayerMoved {
    pub pos: Vec3,
    pub rot: Quat,
}

// player game events
pub const PLAYER_MOVED: &'static str = "PLAYER_MOVED";
pub const PLAYER_ADDED: &'static str = "PLAYER_ADDED";
pub const PLAYER_REMOVED: &'static str = "PLAYER_REMOVED";

// token game events
pub const TOKEN_ADDED: &'static str = "TOKEN_ADDED";
pub const TOKEN_REMOVED: &'static str = "TOKEN_REMOVED";
pub const TOKEN_COLLECTED: &'static str = "TOKEN_COLLECTED";

// game lasers events
pub const LASERS_SHOT: &'static str = "LASERS_SHOT";

// all of these events come from js via polling the blockchain
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCollectibleEventData {
    pub uuid: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePlayerEventData {
    pub uuid: String,
    pub address: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub rot: f64,
    pub w: f64,
    pub r#type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectedEntityEventData {
    pub uuid: String,
    pub player_uuid: String,
    pub value: f64,
    pub time: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerLaserEventData {
    pub player_address: String,
    pub player_uuid: String,
    pub lasers_data: String,
    pub time: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerLaserSerializedData {
    pub player_uuid: String,
    pub uuid: String,
    pub x: f64,
    pub y: f64,
    pub rot: f64,
    pub w: f64,
}
