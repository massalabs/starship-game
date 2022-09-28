use bevy::prelude::*;

#[derive(Component)]
pub struct MassaToken;

// player component
#[derive(Component)]
pub struct Player {
    /// linear speed in meters per second
    pub movement_speed: f32,
    /// rotation speed in radians per second
    pub rotation_speed: f32,
}