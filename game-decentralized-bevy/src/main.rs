#![allow(unused)] // silence unused warnings while exploring (to comment out)

use crate::components::ExplosionToSpawn;
use crate::resources::{RemoteGamePlayerState, RemoteLaserState};
use crate::utils::{inplace_intersection, spawn_laser_closure, spawn_player_name_text2d_entity};
use anyhow::{Context, Result};
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use bevy::math::Vec3Swizzles;
use bevy::reflect::Uuid;
use bevy::sprite::collide_aabb::collide;
use bevy::text::Text2dBounds;
use bevy::utils::HashMap;
use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use bevy_debug_text_overlay::{screen_print, OverlayPlugin};
use components::{
    AnimateNameTranslation, Collectible, Explosion, ExplosionTimer, LaserData, LocalLaser,
    LocalPlayer, Movable, RemoteLaser, RemotePlayer, SpriteSize, Velocity,
};
use errors::ClientError;
use events::{PlayerLaserEventData, PlayerLaserSerializedData, PlayerMoved};
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use resources::{
    CollectedEntity, EntityType, GameTextures, RemoteCollectibleState, RemoteGameState,
    RemoteStateType, WinSize,
};
use rust_js_mappers::{
    get_key_value_from_obj, get_value_for_key, map_js_update_to_rust_entity_state,
};
use std::collections::{BTreeMap, HashSet};
use std::str::FromStr;
use utils::{spawn_collectible_closure, spawn_game_screen_instructions};
use wasm::{GameEntityUpdate, GAME_ENTITY_UPDATE, LOCAL_PLAYER_LASERS, LOCAL_PLAYER_POSITION};
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
const PLAYER_LINEAR_MOVEMENT_SPEED: f32 = 25.0; // linear speed in meters per second
const PLAYER_LINEAR_ROTATION_SPEED: f32 = 300.0; // rotation speed in radians per second

// laser speeds
const LASER_LINEAR_MOVEMENT_SPEED: f32 = 45.0; // linear speed in meters per second

const PLAYER_SPRITES: [(&str, &str); 2] = [
    ("local", "entities/local.v1.png"),
    ("remote", "entities/remote.v2.png"),
];
const PLAYER_SIZE: (f32, f32) = (128., 128.);

const BACKGROUND_SPRITE: &str = "entities/galaxy.png";
const BACKGROUND_SIZE: (f32, f32) = (1000., 50.);

const COLLECTIBLE_SPRITE: &str = "entities/token.png";
const COLLECTIBLE_SIZE: (f32, f32) = (50., 50.);

const PLAYER_LASER_SPRITE: &str = "entities/laser_a_01.png";
const PLAYER_LASER_SIZE: (f32, f32) = (9., 54.);

const EXPLOSION_SHEET: &str = "entities/explo_a_sheet.png";
const EXPLOSION_LEN: usize = 16;

const SPRITE_SCALE: f32 = 0.5;

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
    app.add_plugin(OverlayPlugin {
        font_size: 16.0,
        ..default()
    });
    app.add_event::<PlayerMoved>();
    //app.add_plugin(LogDiagnosticsPlugin::default());
    //app.add_plugin(FrameTimeDiagnosticsPlugin::default());
    app.add_startup_system_to_stage(StartupStage::Startup, setup_system);
    app.add_system_set(
        SystemSet::new()
            .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
            //.with_system(screen_print_text)
            .with_system(local_player_laser_shoot_system)
            .with_system(laser_movable_system)
            .with_system(local_player_movement_system)
            .with_system(on_local_player_moved_system)
            .with_system(entities_from_blockchain_update_system)
            .with_system(interpolate_blockchain_players_state_system)
            .with_system(interpolate_blockchain_lasers_state_system)
            .with_system(player_tag_animation_system)
            .with_system(local_player_collectible_collision_system)
            .with_system(local_player_remote_enemy_lasers_collision_system) // our player getting hit by enemy lasers
            .with_system(remote_player_local_lasers_collision_system) // rendered remote player getting hit by my lasers
            .with_system(explosion_to_spawn_system)
            .with_system(explosion_animation_system),
    );
    app.run();
}

fn screen_print_text(time: Res<Time>) {
    let current_time = time.seconds_since_startup();
    let last_fps = 1.0 / time.delta_seconds_f64();
    screen_print!(sec: 1, col: Color::CYAN, "fps: {last_fps:.0}");
    //screen_print!(sec: 1, col: Color::GREEN, "current time: {current_time:.2}");
}

fn setup_system(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut texture_atlases: ResMut<Assets<TextureAtlas>>,
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
    let laser_texture = asset_server.load(PLAYER_LASER_SPRITE);
    let player_sprites = PLAYER_SPRITES
        .iter()
        .map(|(index, s)| (index.to_string(), asset_server.load(*s)))
        .collect::<HashMap<String, Handle<Image>>>();

    // create explosion texture atlas
    let texture_handle = asset_server.load(EXPLOSION_SHEET);
    let texture_atlas = TextureAtlas::from_grid(texture_handle, Vec2::new(64., 64.), 4, 4);
    let explosion = texture_atlases.add(texture_atlas);

    let game_textures = GameTextures {
        player: player_sprites,
        laser: laser_texture,
        collectible: collectible_texture.clone(),
        background: background_texture.clone(),
        explosion,
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

    // insert the on-screen text instructions
    spawn_game_screen_instructions(&mut commands, &asset_server);
}

fn entities_from_blockchain_update_system(
    time: Res<Time>,
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    asset_server: Res<AssetServer>,
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
                            let player_texture =
                                game_textures.player.get("local").cloned().unwrap();

                            // spawn the local player
                            let local_player_entity = commands
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
                                .insert(LocalPlayer(player_added.uuid.clone()))
                                .insert(SpriteSize::from(PLAYER_SIZE))
                                .insert(Velocity {
                                    linear: PLAYER_LINEAR_MOVEMENT_SPEED,
                                    rotational: f32::to_radians(PLAYER_LINEAR_ROTATION_SPEED),
                                })
                                .id();

                            // spawn the text entity
                            let text2d_entity = spawn_player_name_text2d_entity(
                                &mut commands,
                                &asset_server,
                                &player_added.name,
                                &player_added.position,
                            );
                            commands
                                .entity(text2d_entity)
                                .insert(AnimateNameTranslation(local_player_entity));

                            // map local player uuid - entity id
                            game_state
                                .entity_players
                                .insert(player_added.uuid.clone(), local_player_entity);

                            // add player tag to resources
                            game_state.add_new_player_tag(&player_added.uuid, text2d_entity);
                        }
                        EntityType::Remote => {
                            // add player to state and spawn new entity only if new player uuid
                            if game_state
                                .add_new_remote_player(&player_added.uuid, player_added.clone())
                                .is_none()
                            {
                                // get texture for remote player
                                let player_texture =
                                    game_textures.player.get("remote").cloned().unwrap();

                                // spawn a new player entity
                                let spawned_remote_player_entity = commands
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
                                    .insert(Velocity {
                                        linear: PLAYER_LINEAR_MOVEMENT_SPEED,
                                        rotational: f32::to_radians(PLAYER_LINEAR_ROTATION_SPEED),
                                    })
                                    .id();

                                // spawn the text entity
                                let text2d_entity = spawn_player_name_text2d_entity(
                                    &mut commands,
                                    &asset_server,
                                    &player_added.name,
                                    &player_added.position,
                                );
                                commands
                                    .entity(text2d_entity)
                                    .insert(AnimateNameTranslation(spawned_remote_player_entity));

                                // add player entity to resources
                                game_state.add_new_remote_player_entity(
                                    &player_added.uuid,
                                    spawned_remote_player_entity,
                                );

                                // add player tag to resources
                                game_state.add_new_player_tag(&player_added.uuid, text2d_entity);
                            }
                        }
                    }
                }
                Some(RemoteStateType::PlayerRemoved(player_to_remove)) => {
                    // despawn player entity id
                    if let Some(entity_id) =
                        game_state.get_remote_player_entity(&player_to_remove.uuid)
                    {
                        // despawn the remote player entity
                        commands.entity(*entity_id).despawn();
                    }

                    // despawn tag entity id
                    if let Some(entity_id) =
                        game_state.get_player_tag_entity(&player_to_remove.uuid)
                    {
                        // despawn the remote player tag entity
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
                Some(RemoteStateType::TokenAdded(token_added)) => {
                    // add token state
                    game_state.add_new_collectible(&token_added.uuid, token_added.clone());
                    let entity_id = spawn_collectible_closure(
                        &mut commands,
                        game_textures.collectible.clone(),
                        token_added.clone(),
                    );
                    // add token entity
                    game_state.add_new_collectible_entity(&token_added.uuid, entity_id);
                }
                Some(RemoteStateType::TokenRemoved(RemoteCollectibleState { uuid, .. })) => {
                    // despawn entity id
                    if let Some(entity_id) = game_state.get_collectible_entity(&uuid) {
                        // despawn the remote collectible entity
                        commands.entity(*entity_id).despawn();
                        // remove token state and entity from all collections
                        game_state.remove_collectible(&uuid);
                    }
                }
                Some(RemoteStateType::TokenCollected(CollectedEntity { uuid, .. })) => {
                    //info!("TOKEN COLLECTED {:?}", uuid);
                    // despawn entity id
                    if let Some(entity_id) = game_state.get_collectible_entity(&uuid) {
                        // despawn the remote collectible entity
                        commands.entity(*entity_id).despawn();
                        // remove token state and entity from all collections
                        game_state.remove_collectible(&uuid);
                    }
                }
                Some(RemoteStateType::LasersShot((player_uuid, lasers_shot))) => {
                    //info!("[BEVY] LASERS SHOT {:?}", &lasers_shot);

                    // get current in-memory player lasers map
                    let mut tree_map: BTreeMap<String, RemoteLaserState> = BTreeMap::new();
                    let mut player_lasers_map = game_state
                        .remote_lasers
                        .get(&player_uuid)
                        .unwrap_or_else(|| &mut tree_map)
                        .clone();

                    // 3 options:
                    // - overwrite an existing state
                    // - delete an entry not in the update
                    // - a new laser entry

                    let mut laser_shot_uuids = lasers_shot
                        .iter()
                        .cloned()
                        .map(|shot| shot.uuid)
                        .collect::<HashSet<String>>();
                    //info!("---------------------");
                    //info!("LASERS UPDATE (BEFORE INTERSEC) {:?}", &laser_shot_uuids);

                    let mut game_lasers_uuids = player_lasers_map
                        .keys()
                        .cloned()
                        .collect::<HashSet<String>>();
                    //info!(
                    //    "GAME LASERS (BEFORE INTERSEC) {:?}",
                    //    &game_lasers_uuids
                    //);

                    // -- still persisting lasers. Update values in the states map
                    let persisting_laser_uuids =
                        inplace_intersection(&mut laser_shot_uuids, &mut game_lasers_uuids);
                    /*
                    info!(
                        "PERSISTING LASERS (AFTER INTERSEC)  {:?}",
                        &persisting_laser_uuids
                    );
                    info!(
                        "NEW LASERS (AFTER INTERSEC)  {:?}",
                        &laser_shot_uuids
                    );
                    info!(
                        "LASERS TO BE REMOVED (AFTER INTERSEC)  {:?}",
                        &game_lasers_uuids
                    );
                    */

                    for persisting_laser_uuid in persisting_laser_uuids.iter() {
                        //info!("@@ UPDATING PERSISTING LASER");
                        // get the new recurring state from the sent update
                        let laser_shot_new_state = lasers_shot
                            .iter()
                            .find(|laser| laser.uuid.eq(persisting_laser_uuid))
                            .cloned()
                            .unwrap();
                        // replace the recurring laser in the internal state
                        player_lasers_map.insert(
                            persisting_laser_uuid.clone(),
                            RemoteLaserState {
                                player_uuid: laser_shot_new_state.player_uuid,
                                uuid: laser_shot_new_state.uuid,
                                x: laser_shot_new_state.x,
                                y: laser_shot_new_state.y,
                                rot: laser_shot_new_state.rot,
                                w: laser_shot_new_state.w,
                            },
                        );
                    }

                    // -- laser_shot_uuids must now have the reduced states => only new lasers, create them
                    for laser_shot_uuid in laser_shot_uuids.iter() {
                        //info!("@@ CREATING NEW LASER");
                        // get the new laser state from the sent update
                        let laser_shot_new_state = lasers_shot
                            .iter()
                            .find(|laser| laser.uuid.eq(laser_shot_uuid))
                            .cloned()
                            .unwrap();

                        // spawn the new laser
                        let new_laser_entity_id = spawn_laser_closure(
                            &mut commands,
                            game_textures.laser.clone(),
                            laser_shot_new_state.clone(),
                        );

                        // add the new laser to the internal state
                        player_lasers_map.insert(
                            laser_shot_uuid.clone(),
                            RemoteLaserState {
                                player_uuid: laser_shot_new_state.player_uuid,
                                uuid: laser_shot_new_state.uuid,
                                x: laser_shot_new_state.x,
                                y: laser_shot_new_state.y,
                                rot: laser_shot_new_state.rot,
                                w: laser_shot_new_state.w,
                            },
                        );

                        // TODO: save the new entity id
                        /*
                        game_state
                            .entity_lasers
                            .get_mut(&player_uuid)
                            .and_then(|entities_set| {
                                Some(entities_set.insert(new_laser_entity_id))
                            });
                        */
                    }

                    // -- game_lasers_uuids must now have the reduced states => old lasers to be deleted
                    for laser_to_remove_uuid in game_lasers_uuids.iter() {
                        //info!("@@ REMOVING LASER");
                        // remove laser from the states map
                        player_lasers_map.remove(laser_to_remove_uuid);

                        // TODO: despawn the laser entity
                        /*
                        game_state
                            .entity_lasers
                            .get_mut(&player_uuid)
                            .and_then(|entities_set| {
                                Some(entities_set.insert(new_laser_entity_id))
                            });
                        */
                    }

                    game_state
                        .remote_lasers
                        .insert(player_uuid, player_lasers_map);
                    //info!("---------------------");
                }
                None => {}
            }
        }
    });
}

fn interpolate_blockchain_lasers_state_system(
    mut commands: Commands,
    win_size: Res<WinSize>,
    mut game_state: ResMut<RemoteGameState>,
    mut query: Query<(Entity, &mut Transform, &Velocity, &RemoteLaser), With<RemoteLaser>>,
) {
    for (entity, mut transform, velocity, remote_laser) in query.iter_mut() {
        let LaserData {
            uuid,
            player_uuid,
            start_pos,
            start_rot,
        } = &remote_laser.0;

        if let Some(remote_laser_state) = game_state.remote_lasers.get_mut(player_uuid) {
            let remote_laser_pos = remote_laser_state.get(&uuid.to_string());
            if let Some(remote_laser_pos) = remote_laser_pos {
                // TODO: how to interpolate - use the blockchain x, y state too or just the rotation ?
                transform.rotation = Quat::from_array([
                    0.,
                    0.,
                    remote_laser_pos.rot as f32,
                    remote_laser_pos.w as f32,
                ]);
                let movement_direction = transform.rotation * Vec3::Y;
                transform.translation += movement_direction * velocity.linear * TIME_STEP;

                // despawn when out of screen
                let mut should_despawn = false;

                if transform.translation.y > win_size.h / 2.
                    || transform.translation.y < -win_size.h / 2.
                    || transform.translation.x > win_size.w / 2.
                    || transform.translation.x < -win_size.w / 2.
                {
                    should_despawn = true;
                    commands.entity(entity).despawn();

                    // when out of screen remove remote laser entity if present
                    game_state
                        .entity_lasers
                        .get_mut(player_uuid)
                        .and_then(|entities_set| Some(entities_set.remove(&entity)));
                }
            }
        }
    }
}

fn interpolate_blockchain_players_state_system(
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    mut query: Query<(Entity, &mut Transform, &Velocity, &RemotePlayer), With<RemotePlayer>>,
) {
    for (entity, mut transform, velocity, remote_player) in query.iter_mut() {
        if let Some(player_updated_state) = game_state.remote_players.get_mut(&remote_player.0) {
            // TODO: how to interpolate - use the blockchain x, y state too or just the rotation ?
            transform.rotation = player_updated_state.rotation;
            let movement_direction = transform.rotation * Vec3::Y;
            transform.translation += movement_direction * velocity.linear * TIME_STEP;

            // apply bounds to movement
            let extents = Vec3::from((BOUNDS / 2.0, 0.0));
            transform.translation = transform.translation.clamp(-extents, extents);
        }
    }
}

fn local_player_collectible_collision_system(
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
                //info!("COLLISION: Entity UUID {:?}", &collectible_id.0);
                // remove the collectible
                commands.entity(collectible_entity).despawn();
                despawned_entities.insert(collectible_entity);
                // remove token from all collection states
                game_state.remove_collectible(&collectible_id.0);

                // spawn the explosionToSpawn
                commands
                    .spawn()
                    .insert(ExplosionToSpawn(collectible_tf.translation.clone()));
            }
        }
    }
}

fn local_player_remote_enemy_lasers_collision_system(
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    lasers_query: Query<(Entity, &Transform, &SpriteSize, &RemoteLaser), With<RemoteLaser>>,
    players_query: Query<(Entity, &Transform, &SpriteSize, &LocalPlayer), (With<LocalPlayer>)>,
) {
    let mut despawned_entities: HashSet<Entity> = HashSet::new();

    // iterate through the lasers
    for (laser_entity, laser_tf, laser_size, laser_id) in lasers_query.iter() {
        if despawned_entities.contains(&laser_entity) {
            continue;
        }

        let laser_scale = Vec2::from(laser_tf.scale.xy());

        // iterate through the players
        for (player_entity, player_tf, player_size, local_player) in players_query.iter() {
            if despawned_entities.contains(&player_entity)
                || despawned_entities.contains(&laser_entity)
            {
                continue;
            }
            let player_scale = Vec2::from(player_tf.scale.xy());

            // determine if collision
            let collision = collide(
                laser_tf.translation,
                laser_size.0 * laser_scale,
                player_tf.translation,
                player_size.0 * player_scale,
            );

            // perform collision
            if let Some(_) = collision {
                // remove the laser
                commands.entity(laser_entity).despawn();
                despawned_entities.insert(laser_entity);

                // remote the hit player
                let hit_player = game_state.entity_players.get(&local_player.0);
                if let Some(hit_entity) = hit_player {
                    commands.entity(*hit_entity).despawn();
                }

                // spawn the explosionToSpawn
                commands
                    .spawn()
                    .insert(ExplosionToSpawn(laser_tf.translation.clone()));

                break;
            }
        }
    }
}

fn remote_player_local_lasers_collision_system(
    mut commands: Commands,
    mut game_state: ResMut<RemoteGameState>,
    lasers_query: Query<(Entity, &Transform, &SpriteSize, &LocalLaser), With<LocalLaser>>,
    players_query: Query<(Entity, &Transform, &SpriteSize, &RemotePlayer), (With<RemotePlayer>)>,
) {
    let mut despawned_entities: HashSet<Entity> = HashSet::new();

    // iterate through the lasers
    for (laser_entity, laser_tf, laser_size, laser_id) in lasers_query.iter() {
        if despawned_entities.contains(&laser_entity) {
            continue;
        }

        let laser_scale = Vec2::from(laser_tf.scale.xy());

        // iterate through the players
        for (player_entity, player_tf, player_size, local_player) in players_query.iter() {
            if despawned_entities.contains(&player_entity)
                || despawned_entities.contains(&laser_entity)
            {
                continue;
            }
            let player_scale = Vec2::from(player_tf.scale.xy());

            // determine if collision
            let collision = collide(
                laser_tf.translation,
                laser_size.0 * laser_scale,
                player_tf.translation,
                player_size.0 * player_scale,
            );

            // perform collision
            if let Some(_) = collision {
                // remove the laser
                commands.entity(laser_entity).despawn();
                despawned_entities.insert(laser_entity);

                // remote the hit player
                let hit_player = game_state.entity_players.get(&local_player.0);
                if let Some(hit_entity) = hit_player {
                    commands.entity(*hit_entity).despawn();
                }

                // spawn the explosionToSpawn
                commands
                    .spawn()
                    .insert(ExplosionToSpawn(laser_tf.translation.clone()));

                break;
            }
        }
    }
}

fn local_player_movement_system(
    mut commands: Commands,
    time: Res<Time>,
    game_textures: Res<GameTextures>,
    mut game_state: ResMut<RemoteGameState>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&Velocity, &mut Transform, &LocalPlayer), With<LocalPlayer>>,
) {
    for (velocity, mut transform, local_player) in query.iter_mut() {
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

fn local_player_laser_shoot_system(
    mut commands: Commands,
    time: Res<Time>,
    game_textures: Res<GameTextures>,
    mut game_state: ResMut<RemoteGameState>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&Velocity, &mut Transform, &LocalPlayer), With<LocalPlayer>>,
) {
    for (velocity, mut transform, local_player) in query.iter_mut() {
        // if space is pressed, shoot laser
        if keyboard_input.just_pressed(KeyCode::Space) {
            let uuid = Uuid::new_v4();
            let laser_texture = game_textures.laser.clone();
            let laser_entity_id = commands
                .spawn_bundle(SpriteBundle {
                    texture: laser_texture,
                    transform: Transform {
                        translation: Vec3::new(
                            transform.translation.x,
                            transform.translation.y,
                            0.,
                        ),
                        rotation: transform.rotation.clone(),
                        scale: Vec3::new(SPRITE_SCALE, SPRITE_SCALE, 1.),
                        ..Default::default()
                    },
                    ..Default::default()
                })
                .insert(LocalLaser(LaserData {
                    uuid: uuid.clone(),
                    player_uuid: local_player.0.clone(),
                    start_pos: transform.translation.clone(),
                    start_rot: transform.rotation.clone(),
                }))
                .insert(SpriteSize::from(PLAYER_LASER_SIZE))
                .insert(Movable { auto_despawn: true })
                .insert(Velocity {
                    linear: LASER_LINEAR_MOVEMENT_SPEED,
                    rotational: f32::to_radians(0.0),
                })
                .id();

            // insert the laser entity
            if let Some(entities_set) = game_state.entity_lasers.get_mut(&local_player.0) {
                entities_set.insert(laser_entity_id);
            } else {
                let mut hset = bevy::utils::HashSet::new();
                hset.insert(laser_entity_id);
                game_state
                    .entity_lasers
                    .insert(local_player.0.clone(), hset);
            }
        }
    }
}

fn laser_movable_system(
    mut commands: Commands,
    win_size: Res<WinSize>,
    mut game_state: ResMut<RemoteGameState>,
    mut query: Query<(Entity, &Velocity, &mut Transform, &Movable, &LocalLaser), With<LocalLaser>>,
) {
    let mut serialized_lasers_data: Vec<String> = vec![];
    for (entity, velocity, mut transform, movable, local_laser) in query.iter_mut() {
        let LaserData {
            uuid,
            player_uuid,
            start_pos,
            start_rot,
        } = &local_laser.0;

        // get the laser angle at which it was shot at (it is CONSTANT)
        transform.rotation = start_rot.clone();

        // extrapolate the position
        let movement_direction = transform.rotation * Vec3::Y;
        transform.translation += movement_direction * velocity.linear * TIME_STEP;

        // despawn when out of screen
        let mut should_despawn = false;

        if transform.translation.y > win_size.h / 2.
            || transform.translation.y < -win_size.h / 2.
            || transform.translation.x > win_size.w / 2.
            || transform.translation.x < -win_size.w / 2.
        {
            should_despawn = true;
            commands.entity(entity).despawn();

            // remove laser entity if present
            game_state
                .entity_lasers
                .get_mut(player_uuid)
                .and_then(|entities_set| Some(entities_set.remove(&entity)));
        }

        // any entity that is not to be despawned, is to be serialized and added to the output
        if !should_despawn {
            let serialized_laser = serde_json::to_string(&PlayerLaserSerializedData {
                player_uuid: player_uuid.to_string(),
                uuid: uuid.to_string(),
                x: transform.translation.x as f64,
                y: transform.translation.y as f64,
                rot: transform.rotation.z as f64,
                w: transform.rotation.w as f64,
            })
            .ok();

            // append the serialized data
            if let Some(serialized_laser) = serialized_laser {
                serialized_lasers_data.push(serialized_laser);
            }
        }
    }

    // send over the thread the entire lasers state to the users
    LOCAL_PLAYER_LASERS.with(|pos| {
        let joined_lasers = serialized_lasers_data.join("@");
        *pos.borrow_mut() = Some(joined_lasers);
    });
}

fn player_tag_animation_system(
    mut animation_query: Query<
        (&AnimateNameTranslation, &mut Transform),
        (With<Text>, With<AnimateNameTranslation>),
    >,
    players_query: Query<
        (Entity, &Transform),
        (
            Without<AnimateNameTranslation>,
            Or<(With<LocalPlayer>, With<RemotePlayer>)>,
        ),
    >,
) {
    for (animate_name_translation, mut animation_transform) in &mut animation_query {
        // find the attached player
        let attached_player = players_query
            .iter()
            .find(|(player_entity, player_transform)| {
                animate_name_translation.0.eq(&player_entity)
            });

        // move the player text alongside with the transform coords of the entity
        if let Some((attached_player_entity, attached_player_transform)) = attached_player {
            animation_transform.translation.x = attached_player_transform.translation.x;
            animation_transform.translation.y = attached_player_transform.translation.y;
        }
    }
}

fn explosion_to_spawn_system(
    mut commands: Commands,
    game_textures: Res<GameTextures>,
    query: Query<(Entity, &ExplosionToSpawn)>,
) {
    for (explosion_spawn_entity, explosion_to_spawn) in query.iter() {
        // spawn the explosion sprite
        commands
            .spawn_bundle(SpriteSheetBundle {
                texture_atlas: game_textures.explosion.clone(),
                transform: Transform {
                    translation: explosion_to_spawn.0,
                    ..Default::default()
                },
                ..Default::default()
            })
            .insert(Explosion)
            .insert(ExplosionTimer::default());

        // despawn the explosionToSpawn
        commands.entity(explosion_spawn_entity).despawn();
    }
}

fn explosion_animation_system(
    mut commands: Commands,
    time: Res<Time>,
    mut query: Query<(Entity, &mut ExplosionTimer, &mut TextureAtlasSprite), With<Explosion>>,
) {
    for (entity, mut timer, mut sprite) in query.iter_mut() {
        timer.0.tick(time.delta());
        if timer.0.finished() {
            sprite.index += 1; // move to next sprite cell
            if sprite.index >= EXPLOSION_LEN {
                commands.entity(entity).despawn()
            }
        }
    }
}
