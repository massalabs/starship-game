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
    // virtual x pos
    pub virtual_x: f32,
    // virtual y pos
    pub virtual_y: f32,
}

pub struct Materials {
    pub bullet_material: Color,
}
