use bevy::prelude::{Vec3, Quat};

#[derive(Debug)]
pub struct PlayerMoved {
    pub pos: Vec3,
    pub rot: Quat,
}
