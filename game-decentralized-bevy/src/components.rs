use bevy::math::Vec2;
use bevy::prelude::{Component, Entity, Quat, Vec3};
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
pub struct LocalPlayer;

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

#[derive(Component)]
pub struct LocalLaser(pub (Vec3, Quat));
