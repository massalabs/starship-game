use crate::components::ExplosionToSpawn;
use crate::resources::RemoteGamePlayerState;
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

pub fn spawn_player_name_text2d_entity(
    commands: &mut Commands,
    asset_server: &Res<AssetServer>,
    player_name: &str,
    player_position: &Vec3,
) -> Entity {
    // Demonstrate text wrapping
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
                box_position.x - box_size.x / 2.0,
                box_position.y + box_size.y / 2.0,
                2.0,
            ),
            ..default()
        })
        .id();
    text_2d_entity
}
