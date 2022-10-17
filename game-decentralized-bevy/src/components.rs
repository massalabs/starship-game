use bevy::math::Vec2;
use bevy::prelude::Component;

#[derive(Component, Clone, Debug)]
pub struct SpriteSize(pub Vec2);

impl From<(f32, f32)> for SpriteSize {
    fn from(val: (f32, f32)) -> Self {
        SpriteSize(Vec2::new(val.0, val.1))
    }
}

#[derive(Component, Clone, Debug)]
pub struct Movable {
    pub auto_despawn: bool,
}

#[derive(Component, Clone, Debug)]
pub struct Velocity {
    pub linear: f32,
    pub rotational: f32,
}

#[derive(Component, Clone, Debug)]
pub struct Collectible;

#[derive(Component, Clone, Debug)]
pub struct LocalPlayer;

#[derive(Component, Clone, Debug)]
pub struct RemotePlayer;

#[derive(Component, Clone, Debug)]
pub struct RequiresKinematicUpdate(pub String); // the uuid
