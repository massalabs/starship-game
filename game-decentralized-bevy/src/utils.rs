use crate::components::{
    Collectible, ExplosionToSpawn, LaserData, Movable, RemoteLaser, SpriteSize, Velocity,
};
use crate::events::PlayerLaserSerializedData;
use crate::resources::{RemoteCollectibleState, RemoteGamePlayerState};
use crate::{COLLECTIBLE_SIZE, LASER_LINEAR_MOVEMENT_SPEED, PLAYER_LASER_SIZE, SPRITE_SCALE};
use anyhow::{Context, Result};
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use bevy::math::Vec3Swizzles;
use bevy::sprite::collide_aabb::collide;
use bevy::text::Text2dBounds;
use bevy::utils::HashMap;
use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use bevy_debug_text_overlay::{screen_print, OverlayPlugin};
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use rand::Rng;
use std::collections::HashSet;
use std::hash::Hash;
use std::str::FromStr;
use uuid::Uuid;
use wasm_bindgen::{JsCast, JsValue};

pub fn get_random_f32(
    lower_bound: f32,
    upper_bound: f32,
) -> f32 {
    return rand::thread_rng().gen_range(lower_bound..upper_bound);
}

pub fn get_random_uuid() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}

pub fn spawn_game_screen_instructions(
    commands: &mut Commands,
    asset_server: &Res<AssetServer>,
) -> Entity {
    let font = asset_server.load("entities/FiraMono-Medium.ttf");
    let text_style = TextStyle {
        font,
        font_size: 15.0,
        color: Color::PINK,
    };
    let text_alignment = TextAlignment::CENTER;
    let box_size = Vec2::new(250.0, 100.0);
    let box_position = Vec2::new(280.0, 250.0);
    let text_2d_entity = commands
        .spawn_bundle(Text2dBundle {
            text: Text::from_section("← → left/right, SPACE - shoot", text_style),
            text_2d_bounds: Text2dBounds { size: box_size },
            transform: Transform::from_xyz(box_position.x, box_position.y, 2.0),
            ..default()
        })
        .id();
    text_2d_entity
}

pub fn spawn_player_name_text2d_entity(
    commands: &mut Commands,
    asset_server: &Res<AssetServer>,
    player_name: &str,
    player_position: &Vec3,
) -> Entity {
    let font = asset_server.load("entities/FiraMono-Medium.ttf");
    let text_style = TextStyle {
        font,
        font_size: 15.0,
        color: Color::GREEN,
    };
    let text_alignment = TextAlignment::CENTER;
    let box_size = Vec2::new(200.0, 100.0);
    let box_position = Vec2::new(player_position.x, player_position.y);
    let text_2d_entity = commands
        .spawn_bundle(Text2dBundle {
            text: Text::from_section(player_name, text_style),
            text_2d_bounds: Text2dBounds { size: box_size },
            transform: Transform::from_xyz(
                box_position.x - box_size.x / 2.0 + 35.0,
                box_position.y + box_size.y / 2.0,
                2.0,
            ),
            ..default()
        })
        .id();
    text_2d_entity
}

/// Extracts the common values in `a` and `b` into a new set.
pub fn inplace_intersection<T>(
    a: &mut HashSet<T>,
    b: &mut HashSet<T>,
) -> HashSet<T>
where
    T: Hash,
    T: Eq,
{
    let x: HashSet<(T, bool)> = a
        .drain()
        .map(|v| {
            let intersects = b.contains(&v);
            (v, intersects)
        })
        .collect();

    let mut c = HashSet::new();
    for (v, is_inter) in x {
        if is_inter {
            c.insert(v);
        } else {
            a.insert(v);
        }
    }

    b.retain(|v| !c.contains(&v));

    c
}

pub fn spawn_laser_closure(
    commands: &mut Commands,
    laser_texture: Handle<Image>,
    state: PlayerLaserSerializedData,
) -> Entity {

    let turret_transform = Transform {
        rotation: Quat::from_array([0., 0., state.rot as f32, state.w as f32]),
        translation: Vec3::Z,
        ..Default::default()
    };
    let laser_unit_direction = turret_transform.rotation * Vec3::Y;

    commands
        .spawn_bundle(SpriteBundle {
            texture: laser_texture,
            transform: Transform {
                translation: Vec3::new(state.x as f32, state.y as f32, 1.0), // set z axis to 1 so tokens stay above
                rotation: Quat::from_array([0., 0., state.rot as f32, state.w as f32]),
                scale: Vec3::new(SPRITE_SCALE, SPRITE_SCALE, 1.),
                ..Default::default()
            },
            ..Default::default()
        })
        .insert(RemoteLaser(LaserData {
            uuid: Uuid::from_str(&state.uuid).expect("A proper uuid"),
            player_uuid: state.player_uuid.clone(),
            start_pos: Vec3::new(state.x as f32, state.y as f32, 1.0),
            unit_direction_vector: laser_unit_direction
        }))
        .insert(SpriteSize::from(PLAYER_LASER_SIZE))
        .insert(Movable { auto_despawn: true })
        .insert(Velocity {
            linear: LASER_LINEAR_MOVEMENT_SPEED,
            rotational: f32::to_radians(0.0),
        })
        .id()
}

pub fn spawn_collectible_closure(
    commands: &mut Commands,
    collectible_texture: Handle<Image>,
    state: RemoteCollectibleState,
) -> Entity {
    commands
        .spawn_bundle(SpriteBundle {
            texture: collectible_texture,
            transform: Transform {
                translation: Vec3::new(state.position.x, state.position.y, 1.0), // set z axis to 1 so tokens stay above
                scale: Vec3::new(0.5, 0.5, 1.),
                ..Default::default()
            },
            ..Default::default()
        })
        .insert(Collectible(state.uuid.clone()))
        .insert(SpriteSize::from(COLLECTIBLE_SIZE))
        .id()
}
