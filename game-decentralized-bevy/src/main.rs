#![allow(unused)] // silence unused warnings while exploring (to comment out)

use crate::resources::RemoteGamePlayerState;
use anyhow::{Context, Result};
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use bevy::math::Vec3Swizzles;
use bevy::sprite::collide_aabb::collide;
use bevy::utils::HashMap;
use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use components::{Collectible, LocalPlayer, Movable, RemotePlayer, SpriteSize, Velocity};
use errors::ClientError;
use events::PlayerMoved;
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use resources::{
    CollectedEntity, EntityType, GameTextures, RemoteCollectibleState, RemoteGameState,
    RemoteStateType, WinSize,
};
use rust_js_mappers::{
    get_key_value_from_obj, get_value_for_key, map_js_update_to_rust_entity_state,
};
use std::collections::HashSet;
use wasm::{GameEntityUpdate, GAME_ENTITY_UPDATE, LOCAL_PLAYER_POSITION};
use wasm_bindgen::{JsCast, JsValue};

pub mod components;
pub mod errors;
pub mod events;
pub mod resources;
pub mod rust_js_mappers;
pub mod utils;
pub mod wasm;

// global settings

// timestep (fps)
const TIME_STEP: f32 = 1.0 / 50.0;

// screen
const SCREEN_WIDTH: f32 = 1000.0;
const SCREEN_HEIGHT: f32 = 500.0;
const BOUNDS: Vec2 = Vec2::from_array([SCREEN_WIDTH, SCREEN_HEIGHT]);

// player speeds
const LINEAR_MOVEMENT_SPEED: f32 = 25.0; // linear speed in meters per second
const LINEAR_ROTATION_SPEED: f32 = 300.0; // rotation speed in radians per second

const PLAYER_SPRITES: [(usize, &str); 2] =
    [(1, "entities/local.v1.png"), (2, "entities/remote.v1.png")];
const PLAYER_SIZE: (f32, f32) = (128., 128.);

const BACKGROUND_SPRITE: &str = "entities/galaxy.png";
const BACKGROUND_SIZE: (f32, f32) = (1000., 50.);

const COLLECTIBLE_SPRITE: &str = "entities/token.png";
const COLLECTIBLE_SIZE: (f32, f32) = (50., 50.);

fn main() {
    let mut app = App::new();
    app.insert_resource(WindowDescriptor {
        title: "Starship!".to_string(),
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        present_mode: PresentMode::AutoVsync,
        #[cfg(target_arch = "wasm32")]
        canvas: Some(String::from("#game")),
        ..Default::default()
    });
    app.add_plugins(DefaultPlugins);
    app.add_event::<PlayerMoved>();
    //app.add_plugin(LogDiagnosticsPlugin::default());
    //app.add_plugin(FrameTimeDiagnosticsPlugin::default());
    app.add_startup_system_to_stage(StartupStage::Startup, setup_system);
    app.add_system_set(
        SystemSet::new()
            .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
            .with_system(local_player_movement_system)
            .with_system(on_local_player_moved_system)
            .with_system(entities_from_blockchain_update_system)
            .with_system(interpolate_blockchain_entities_state_system)
            .with_system(player_collectible_collision_system),
    );
    app.run();
}

fn setup_system(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut windows: ResMut<Windows>,
) {
    // 2D orthographic camera
    commands.spawn_bundle(Camera2dBundle::default());

    // capture windows size
    let window = windows.get_primary_mut().unwrap();
    let (win_w, win_h) = (window.width(), window.height());

    // add WinSize resource
    let win_size = WinSize { w: win_w, h: win_h };
    commands.insert_resource(win_size);

    // load texture atlas and create a resource with Textures
    let background_texture = asset_server.load(BACKGROUND_SPRITE);
    let collectible_texture = asset_server.load(COLLECTIBLE_SPRITE);
    let player_sprites = PLAYER_SPRITES
        .iter()
        .map(|(index, s)| (*index, asset_server.load(*s)))
        .collect::<HashMap<usize, Handle<Image>>>();

    let game_textures = GameTextures {
        player: player_sprites,
        collectible: collectible_texture.clone(),
        background: background_texture.clone(),
    };
    commands.insert_resource(game_textures);

    // insert the game state as a resource
    let game_state = RemoteGameState::default();
    commands.insert_resource(game_state);

    // add galaxy background
    commands.spawn_bundle(SpriteBundle {
        texture: background_texture,
        ..default()
    });
}

fn entities_from_blockchain_update_system(
    time: Res<Time>,
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    game_textures: Res<GameTextures>,
) {
    GAME_ENTITY_UPDATE.with(|entities_update| {
        let entities_update = entities_update.take();
        for entity in entities_update.into_iter() {
            let mapped_update = map_js_update_to_rust_entity_state(entity)
                .map_err(|err| error!("Map error {:?}", err.to_string()))
                .unwrap();
            match mapped_update {
                Some(RemoteStateType::PlayerAdded(player_added)) => {
                    match player_added.r#type {
                        EntityType::Local => {
                            // get texture for local player
                            let player_texture = game_textures.player.get(&1).cloned().unwrap();

                            commands
                                .spawn_bundle(SpriteBundle {
                                    texture: player_texture,
                                    transform: Transform {
                                        translation: player_added.position,
                                        rotation: player_added.rotation,
                                        scale: Vec3::new(0.5, 0.5, -1.),
                                        ..Default::default()
                                    },
                                    ..Default::default()
                                })
                                .insert(LocalPlayer)
                                .insert(SpriteSize::from(PLAYER_SIZE))
                                .insert(Movable {
                                    auto_despawn: false,
                                })
                                .insert(Velocity {
                                    linear: LINEAR_MOVEMENT_SPEED,
                                    rotational: f32::to_radians(LINEAR_ROTATION_SPEED),
                                });
                        }
                        EntityType::Remote => {
                            // add player to state and spawn new entity only if new player uuid
                            if game_state
                                .add_new_remote_player(&player_added.uuid, player_added.clone())
                                .is_none()
                            {
                                // get texture for remote player
                                let player_texture = game_textures.player.get(&1).cloned().unwrap();

                                let spawned_remote_player = commands
                                    .spawn_bundle(SpriteBundle {
                                        texture: player_texture,
                                        transform: Transform {
                                            translation: player_added.position,
                                            rotation: player_added.rotation,
                                            scale: Vec3::new(0.5, 0.5, -1.),
                                            ..Default::default()
                                        },
                                        ..Default::default()
                                    })
                                    .insert(RemotePlayer(player_added.uuid.clone()))
                                    .insert(SpriteSize::from(PLAYER_SIZE))
                                    .insert(Movable { auto_despawn: true })
                                    .insert(Velocity {
                                        linear: LINEAR_MOVEMENT_SPEED,
                                        rotational: f32::to_radians(LINEAR_ROTATION_SPEED),
                                    })
                                    .id();

                                game_state.add_new_remote_player_entity(
                                    &player_added.uuid,
                                    spawned_remote_player,
                                );
                            }
                        }
                    }
                }
                Some(RemoteStateType::PlayerRemoved(player_to_remove)) => {
                    // despawn entity id
                    if let Some(entity_id) =
                        game_state.get_remote_player_entity(&player_to_remove.uuid)
                    {
                        // despawn the remote player entity
                        commands.entity(*entity_id).despawn();
                    }
                    // remove player from all collection states
                    game_state.remove_remote_player(&player_to_remove.uuid);
                }
                Some(RemoteStateType::PlayerMoved(player_moved)) => {
                    // check to see if the player has an entity id already (is registered). If not, skip update
                    if let Some(_player) = game_state.remote_players.get(&player_moved.uuid) {
                        // update the inner state
                        game_state
                            .remote_players
                            .insert(player_moved.uuid.clone(), player_moved.clone());
                    }
                }
                Some(RemoteStateType::TokenCollected(token_collected)) => { /* TODO */ }
                Some(RemoteStateType::TokenAdded(token_added)) => {
                    let mut spawn_collectible_closure = |collectible_texture: Handle<Image>,
                                                         state: RemoteCollectibleState|
                     -> Entity {
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
                            .insert(Movable { auto_despawn: true })
                            .id()
                    };

                    game_state.add_new_collectible(&token_added.uuid, token_added.clone());
                    let entity_id = spawn_collectible_closure(
                        game_textures.collectible.clone(),
                        token_added.clone(),
                    );
                    game_state.add_new_collectible_entity(&token_added.uuid, entity_id);
                }
                Some(RemoteStateType::TokenRemoved(token_removed)) => {
                    // despawn entity id
                    if let Some(entity_id) = game_state.get_collectible_entity(&token_removed.uuid)
                    {
                        // despawn the remote collectible entity
                        commands.entity(*entity_id).despawn();
                    }
                    // remove token from all collection states
                    game_state.remove_collectible(&token_removed.uuid);
                }
                None => {}
            }
        }
    });
}

fn interpolate_blockchain_entities_state_system(
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    mut query: Query<(Entity, &mut Transform, &Velocity, &RemotePlayer), With<RemotePlayer>>,
) {
    for (entity, mut transform, velocity, remote_player) in query.iter_mut() {
        if let Some(player_updated_state) = game_state.remote_players.get_mut(&remote_player.0) {
            transform.rotation = player_updated_state.rotation;
            let movement_direction = transform.rotation * Vec3::Y;
            transform.translation += movement_direction * velocity.linear * TIME_STEP;

            // apply bounds to movement
            let extents = Vec3::from((BOUNDS / 2.0, 0.0));
            transform.translation = transform.translation.clamp(-extents, extents);
        }
    }
}

fn player_collectible_collision_system(
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    collectibles_query: Query<(Entity, &Transform, &SpriteSize, &Collectible), With<Collectible>>,
    players_query: Query<
        (Entity, &Transform, &SpriteSize),
        (Or<(With<LocalPlayer>, With<RemotePlayer>)>),
    >,
) {
    let mut despawned_entities: HashSet<Entity> = HashSet::new();

    // iterate through the collectibles
    for (collectible_entity, collectible_tf, collectible_size, collectible_id) in
        collectibles_query.iter()
    {
        if despawned_entities.contains(&collectible_entity) {
            continue;
        }

        let collectible_scale = Vec2::from(collectible_tf.scale.xy());

        // iterate through the players
        for (player_entity, player_tf, player_size) in players_query.iter() {
            if despawned_entities.contains(&player_entity)
                || despawned_entities.contains(&collectible_entity)
            {
                continue;
            }
            let player_scale = Vec2::from(player_tf.scale.xy());

            // determine if collision
            let collision = collide(
                collectible_tf.translation,
                collectible_size.0 * collectible_scale,
                player_tf.translation,
                player_size.0 * player_scale,
            );

            // perform collision
            if let Some(_) = collision {
                info!("COLLISION: Entity UUID {:?}", &collectible_id.0);
                // remove the collectible
                commands.entity(collectible_entity).despawn();
                despawned_entities.insert(collectible_entity);
                // remove token from all collection states
                game_state.remove_collectible(&collectible_id.0);
            }
        }
    }
}

fn local_player_movement_system(
    time: Res<Time>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&Velocity, &mut Transform), With<LocalPlayer>>,
) {
    for (velocity, mut transform) in query.iter_mut() {
        // ship rotation
        let mut rotation_factor = 0.0;

        if keyboard_input.pressed(KeyCode::Left) {
            rotation_factor += 1.0;
        }

        if keyboard_input.pressed(KeyCode::Right) {
            rotation_factor -= 1.0;
        }

        let rotation_delta =
            Quat::from_rotation_z(rotation_factor * velocity.rotational * TIME_STEP);
        transform.rotation *= rotation_delta;

        let movement_direction = transform.rotation * Vec3::Y;
        transform.translation += movement_direction * velocity.linear * TIME_STEP;

        // limit the movement within the screen
        let extents = Vec3::from((BOUNDS / 2.0, 0.0));
        transform.translation = transform.translation.clamp(-extents, extents);

        // send message about player translation
        player_moved_events.send(PlayerMoved {
            pos: transform.translation,
            rot: transform.rotation,
        });
    }
}

fn on_local_player_moved_system(mut events: EventReader<PlayerMoved>) {
    for movement_event in events.iter() {
        // on each player move push the new position to js over the wasm-bounded thread
        LOCAL_PLAYER_POSITION.with(|pos| {
            pos.borrow_mut()
                .from_game_vector(movement_event.pos, movement_event.rot);
        });
    }
}
