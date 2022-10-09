use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use components::{Blockchainable, Identifyable, LocalPlayer, Movable, Velocity};
use events::PlayerMoved;
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use player::PlayerPlugin;
use resources::{RemoteGameState, GameTextures, RemoteStateType, WinSize};
use wasm::{GameEntityUpdate, GAME_ENTITY_UPDATE, LOCAL_PLAYER_POSITION};
use wasm_bindgen::{JsCast, JsValue};
use crate::resources::RemoteGamePlayerState;

pub mod collectible;
pub mod components;
pub mod events;
pub mod player;
pub mod resources;
pub mod utils;
pub mod wasm;

// global settings
const TIME_STEP: f32 = 1.0 / 50.0;
const SCREEN_WIDTH: f32 = 1000.0;
const SCREEN_HEIGHT: f32 = 500.0;
const BOUNDS: Vec2 = Vec2::from_array([SCREEN_WIDTH, SCREEN_HEIGHT]);
const LINEAR_MOVEMENT_SPEED: f32 = 60.0; // linear speed in meters per second
const LINEAR_ROTATION_SPEED: f32 = 360.0; // rotation speed in radians per second

const PLAYER_SPRITE: &str = "entities/ship_64x64.png";
const PLAYER_SIZE: (f32, f32) = (64., 64.);

const BACKGROUND_SPRITE: &str = "entities/galaxy.png";
const BACKGROUND_SIZE: (f32, f32) = (1000., 50.);

const COLLECTIBLE_SPRITE: &str = "entities/galaxy.png";
const COLLECTIBLE_SIZE: (f32, f32) = (50., 50.);

const PLAYER_MOVED: &'static str = "PLAYER_MOVED";
const GAME_TOKENS_STATE_UPDATED: &'static str = "GAME_TOKENS_STATE_UPDATED";
const PLAYER_ADDED: &'static str = "PLAYER_ADDED";
const PLAYER_REMOVED: &'static str = "PLAYER_REMOVED";
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
    app.add_plugin(PlayerPlugin);
    //app.add_startup_system(setup_system);
    app.add_startup_system_to_stage(StartupStage::Startup, setup_system);
    app.add_system(entities_update_system);
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


fn get_value_for_key(key: &str, object: &JsValue) -> Option<JsValue> {
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
    let x = get_value_for_key("x", &js_obj).expect("Some x to be present");
    let y = get_value_for_key("y", &js_obj).expect("Some y to be present");
    let rot = get_value_for_key("rot", &js_obj).expect("Some rot to be present");

    info!("PLAYER_ADDED/MOVED {:?} {:?} {:?} {:?} {:?} {:?}", operation, uuid, address, x, y ,rot);

    let entity_state = if operation.eq(&JsValue::from(PLAYER_ADDED)) || operation.eq(&JsValue::from(PLAYER_MOVED)) {
        info!("PLAYER_ADDED/MOVED");
        Some(RemoteStateType::PlayerMoved(RemoteGamePlayerState{
            uuid: uuid.as_string().unwrap(),
            address: address.as_string().unwrap(),
            position: Vec3::new(x.as_f64().unwrap() as f32, y.as_f64().unwrap() as f32, 0.0f32),
            rotation: Quat::from_rotation_z(rot.as_f64().unwrap() as f32)
        }))
    } else if operation.eq(&JsValue::from(PLAYER_REMOVED)) {
        info!("PLAYER_REMOVED");
        None
    } else if operation.eq(&JsValue::from(TOKEN_COLLECTED)) {
        info!("TOKEN_COLLECTED");
        None
    } else if operation.eq(&JsValue::from(GAME_TOKENS_STATE_UPDATED)) {
        info!("GAME_TOKENS_STATE_UPDATED");
        None
    } else { None };

    entity_state
}

fn entities_update_system(
    time: Res<Time>,
    commands: Commands,
    game_state: ResMut<RemoteGameState>
) {
    GAME_ENTITY_UPDATE.with(|entities_update| {
        let entities_update = entities_update.take();
        for entity in entities_update.into_iter() {
            let mapped_update = map_js_update_to_rust_entity_state(entity);
            match mapped_update {
                Some(RemoteStateType::PlayerAdded(player_added)) => {
                    // spawn new entity
                },
                Some(RemoteStateType::PlayerRemoved(player_removed)) => {
                    // despawn enitty id
                },
                Some(RemoteStateType::PlayerMoved(player_moved)) => {
                    
                },
                Some(RemoteStateType::TokenCollected(token_collected)) => {
                    
                },
                Some(RemoteStateType::GameTokensUpdated(tokens_updated)) => {
                    
                },
                None => {

                }
            }
        }

        // spawn a new [player]/[token] etc.
        //... or
        // ... update [player]/[token] etc.
    });
}
