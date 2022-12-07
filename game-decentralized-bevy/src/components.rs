use bevy::math::Vec2;
use bevy::prelude::{Component, Entity, Quat, Vec3};
use bevy::reflect::Uuid;
use bevy::time::Timer;

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
pub struct Collectible(pub String); // the external uuid

#[derive(Component, Clone, Debug)]
pub struct LocalPlayer(pub String); // the external uuid

#[derive(Component, Clone, Debug)]
pub struct RemotePlayer(pub String); // the external uuid

#[derive(Component)]
pub struct ExplosionToSpawn(pub Vec3);

#[derive(Component)]
pub struct Explosion;

#[derive(Component)]
pub struct ExplosionTimer(pub Timer);

impl Default for ExplosionTimer {
    fn default() -> Self {
        Self(Timer::from_seconds(0.05, true))
    }
}

#[derive(Component)]
pub struct AnimateNameTranslation(pub Entity);

//components that dont exchange data with react (just for internal markers use)
#[derive(Component)]
pub struct LocalLaser(pub LaserData);

#[derive(Component)]
pub struct RemoteLaser(pub LaserData);

pub struct LaserData {
    pub uuid: Uuid,
    pub player_uuid: String,
    pub start_pos: Vec3,
    pub unit_direction_vector: Vec3,
}
