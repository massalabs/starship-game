use bevy::prelude::{Quat, Vec3};

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
