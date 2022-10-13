use crate::resources::RemoteGamePlayerState;
use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use components::{
    Blockchainable, Collectible, Identifyable, Movable, RemotePlayer, SpriteSize,
    Velocity, RequiresKinematicUpdate,
};
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use player::PlayerPlugin;
use resources::{GameTextures, RemoteCollectibleState, RemoteGameState, RemoteStateType, WinSize};
use wasm::{GameEntityUpdate, GAME_ENTITY_UPDATE, LOCAL_PLAYER_POSITION};
use wasm_bindgen::{JsCast, JsValue};

pub mod collectible;
pub mod components;
pub mod events;
pub mod player;
pub mod resources;
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
const LINEAR_MOVEMENT_SPEED: f32 = 60.0; // linear speed in meters per second
const LINEAR_ROTATION_SPEED: f32 = 360.0; // rotation speed in radians per second

const PLAYER_SPRITE: &str = "entities/ship_64x64.png";
const PLAYER_SIZE: (f32, f32) = (64., 64.);

const BACKGROUND_SPRITE: &str = "entities/galaxy.png";
const BACKGROUND_SIZE: (f32, f32) = (1000., 50.);

const COLLECTIBLE_SPRITE: &str = "entities/token.png";
const COLLECTIBLE_SIZE: (f32, f32) = (50., 50.);

// player game events
const PLAYER_MOVED: &'static str = "PLAYER_MOVED";
const PLAYER_ADDED: &'static str = "PLAYER_ADDED";
const PLAYER_REMOVED: &'static str = "PLAYER_REMOVED";

// token game events
const TOKEN_ADDED: &'static str = "TOKEN_ADDED";
const TOKEN_REMOVED: &'static str = "TOKEN_REMOVED";
const TOKEN_COLLECTED: &'static str = "TOKEN_COLLECTED";

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
    //app.add_plugin(LogDiagnosticsPlugin::default());
    //app.add_plugin(FrameTimeDiagnosticsPlugin::default());
    app.add_plugin(PlayerPlugin);
    //app.add_startup_system(setup_system);
    app.add_startup_system_to_stage(StartupStage::Startup, setup_system);
    app.add_system(entities_from_blockchain_update_system);
    app.add_system(only_entities_with_kinematic_update);
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
    let player_texture = asset_server.load(PLAYER_SPRITE);

    let game_textures = GameTextures {
        player: player_texture.clone(),
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

fn get_value_for_key(
    key: &str,
    object: &JsValue,
) -> Option<JsValue> {
    let key = JsValue::from(key);
    let value = Reflect::get(&object, &key).ok();
    value
}

fn map_js_update_to_rust_entity_state(entity: GameEntityUpdate) -> Option<RemoteStateType> {
    let js_obj: JsValue = entity.into();
    //  we can safely unwrap all options as we know that none-existing js values will be marked as JsValue::unedefined
    let operation = get_value_for_key("operation", &js_obj).expect("Some operation to be present");
    let uuid = get_value_for_key("uuid", &js_obj).expect("Some uuid to be present");
    let address = get_value_for_key("address", &js_obj).expect("Some address to be present");
    let name = get_value_for_key("name", &js_obj).expect("Some name to be present");
    let x = get_value_for_key("x", &js_obj).expect("Some x to be present");
    let y = get_value_for_key("y", &js_obj).expect("Some y to be present");
    let rot = get_value_for_key("rot", &js_obj).expect("Some rot to be present");

    let entity_state = if operation.eq(&JsValue::from(PLAYER_ADDED)) {
        info!("PLAYER_ADDED");
        Some(RemoteStateType::PlayerAdded(RemoteGamePlayerState {
            uuid: uuid.as_string().unwrap(),
            address: address.as_string().unwrap(),
            name: name.as_string().unwrap(),
            position: Vec3::new(
                x.as_f64().unwrap() as f32,
                y.as_f64().unwrap() as f32,
                0.0f32,
            ),
            rotation: Quat::from_rotation_z(rot.as_f64().unwrap() as f32),
        }))
    } else if operation.eq(&JsValue::from(PLAYER_MOVED)) {
        info!("PLAYER_MOVED");
        Some(RemoteStateType::PlayerMoved(RemoteGamePlayerState {
            uuid: uuid.as_string().unwrap(),
            address: address.as_string().unwrap(),
            name: name.as_string().unwrap(),
            position: Vec3::new(
                x.as_f64().unwrap() as f32,
                y.as_f64().unwrap() as f32,
                0.0f32,
            ),
            rotation: Quat::from_rotation_z(rot.as_f64().unwrap() as f32),
        }))
    } else if operation.eq(&JsValue::from(PLAYER_REMOVED)) {
        info!("PLAYER_REMOVED");
        Some(RemoteStateType::PlayerRemoved(RemoteGamePlayerState {
            uuid: uuid.as_string().unwrap(),
            address: address.as_string().unwrap(),
            name: name.as_string().unwrap(),
            position: Vec3::new(
                x.as_f64().unwrap() as f32,
                y.as_f64().unwrap() as f32,
                0.0f32,
            ),
            rotation: Quat::from_rotation_z(rot.as_f64().unwrap() as f32),
        }))
    } else if operation.eq(&JsValue::from(TOKEN_COLLECTED)) {
        //info!("TOKEN_COLLECTED");
        None
    } else if operation.eq(&JsValue::from(TOKEN_ADDED)) {
        //info!("TOKEN_ADDED");
        Some(RemoteStateType::TokenAdded(RemoteCollectibleState {
            uuid: uuid.as_string().unwrap(),
            position: Vec3::new(
                x.as_f64().unwrap() as f32,
                y.as_f64().unwrap() as f32,
                0.0f32,
            ),
        }))
    } else if operation.eq(&JsValue::from(TOKEN_REMOVED)) {
        //info!("TOKEN_REMOVED");
        Some(RemoteStateType::TokenRemoved(RemoteCollectibleState {
            uuid: uuid.as_string().unwrap(),
            position: Vec3::new(
                x.as_f64().unwrap() as f32,
                y.as_f64().unwrap() as f32,
                0.0f32,
            ),
        }))
    } else {
        None
    };

    entity_state
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
            let mapped_update = map_js_update_to_rust_entity_state(entity);
            match mapped_update {
                Some(RemoteStateType::PlayerAdded(player_added)) => {
                    // add player to state and spawn new entity only if new player uuid
                    if game_state
                        .add_new_player(&player_added.uuid, player_added.clone())
                        .is_none()
                    {
                        let player_texture = game_textures.player.clone();

                        let spawned_remote_player = commands
                            .spawn_bundle(SpriteBundle {
                                texture: player_texture,
                                transform: Transform {
                                    translation: player_added.position,
                                    rotation: player_added.rotation,
                                    ..Default::default()
                                },
                                ..Default::default()
                            })
                            .insert(RemotePlayer)
                            .insert(SpriteSize::from(PLAYER_SIZE))
                            .insert(Movable { auto_despawn: true })
                            .insert(Velocity {
                                linear: LINEAR_MOVEMENT_SPEED,
                                rotational: f32::to_radians(LINEAR_ROTATION_SPEED),
                            })
                            .insert(Blockchainable {
                                address: player_added.address.clone(),
                            })
                            .insert(Identifyable(player_added.uuid.clone()))
                            .id();

                        game_state.add_new_player_entity(&player_added.uuid, spawned_remote_player);
                    }
                }
                Some(RemoteStateType::PlayerRemoved(player_to_remove)) => {
                    // despawn entity id
                    if let Some(entity_id) = game_state.get_player_entity(&player_to_remove.uuid) {
                        // despawn the remote player entity
                        commands.entity(*entity_id).despawn();
                    }
                    // remove player from all collection states
                    game_state.remove_player(&player_to_remove.uuid);
                }
                Some(RemoteStateType::PlayerMoved(player_moved)) => {

                    // check to see if the player has an entity id already (is registered). If not, skip update
                    if let Some(player) = game_state.entity_players.get(&player_moved.uuid) {
                        // add a component
                        commands.entity(*player).insert(RequiresKinematicUpdate(player_moved.uuid.clone()));
                    }

                    if let Some(_player) = game_state.remote_players.get(&player_moved.uuid) {
                        // update the inner state
                        game_state.remote_players.insert(player_moved.uuid.clone(), player_moved.clone());
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
                            .insert(Collectible)
                            .insert(SpriteSize::from(COLLECTIBLE_SIZE))
                            .insert(Movable { auto_despawn: true })
                            .insert(Identifyable(state.uuid.clone()))
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

fn only_entities_with_kinematic_update(
    mut commands: Commands,
    game_state: Res<RemoteGameState>,
    mut query: Query<(Entity, &mut Transform, &RequiresKinematicUpdate), (With<RequiresKinematicUpdate>, With<RemotePlayer>)>,
) {
    for (entity, mut transform, kinematic_update) in query.iter_mut() {
        if let Some(player_updated_state) = game_state.remote_players.get(&kinematic_update.0) {
            transform.translation = player_updated_state.position;
            transform.rotation = player_updated_state.rotation;
        }
        // remove the component RequiresKinematicUpdate
        commands.entity(entity).remove::<RequiresKinematicUpdate>();
    }
}