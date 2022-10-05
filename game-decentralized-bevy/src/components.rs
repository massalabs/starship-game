use bevy::prelude::{*, shape::Quad};


// player component
#[derive(Component)]
pub struct MassaToken {
    pub uuid: String,
    /// linear speed in meters per second
    pub pos: Vec2,
    /// rotation speed in radians per second
    pub rot: Quad,
}

// player component
#[derive(Component)]
pub struct Player {
    /// linear speed in meters per second
    pub movement_speed: f32,
    /// rotation speed in radians per second
    pub rotation_speed: f32,
}