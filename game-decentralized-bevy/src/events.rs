use bevy::prelude::{Quat, Vec3};

#[derive(Debug)]
pub struct PlayerMoved {
    pub pos: Vec3,
    pub rot: Quat,
}
