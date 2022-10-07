use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use components::{Blockchainable, Identifyable, LocalPlayer, Movable, Velocity};
use events::PlayerMoved;
use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use rand::Rng;
use resources::{GameState, GameTextures, WinSize};
use wasm::{GAME_ENTITY_UPDATE, LOCAL_PLAYER_POSITION};
use wasm_bindgen::{JsCast, JsValue};

pub mod collectible;
pub mod components;
pub mod events;
pub mod player;
pub mod resources;
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

#[derive(Component)]
pub struct SpriteSize(pub Vec2);

impl From<(f32, f32)> for SpriteSize {
    fn from(val: (f32, f32)) -> Self {
        SpriteSize(Vec2::new(val.0, val.1))
    }
}

fn get_random_f32() -> f32 {
    return rand::thread_rng().gen_range(-400.0..400.0);
}

fn get_random_uuid() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}

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
    app.add_startup_system(setup_system)
        .add_system_set(
            SystemSet::new()
                .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
                .with_system(player_movement_system)
                .with_system(on_player_moved_system)
                .with_system(entity_added),
            //.with_system(change_color)
        )
        .run();
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
    let background_collectible = asset_server.load(COLLECTIBLE_SPRITE);
    let background_player = asset_server.load(PLAYER_SPRITE);

    let game_textures = GameTextures {
        player: background_player.clone(),
        collectible: background_collectible.clone(),
        background: background_texture.clone(),
    };
    commands.insert_resource(game_textures);

    // insert the game state as a resource
    let game_state = GameState::default();
    commands.insert_resource(game_state);

    // add galaxy background
    commands.spawn_bundle(SpriteBundle {
        texture: background_texture,
        ..default()
    });

    // player controlled ship
    commands
        .spawn_bundle(SpriteBundle {
            texture: background_player,
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
        })
        .insert(Blockchainable {
            address: "".to_owned(),
        }) // TODO: get address from outside
        .insert(Identifyable("uuid".to_owned())); // TODO: get ID from outside
}

fn player_movement_system(
    time: Res<Time>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&Velocity, &mut Transform), With<LocalPlayer>>,
) {
    let (velocity, mut transform) = query.single_mut();

    // ship rotation
    let mut rotation_factor = 0.0;
    let mut movement_factor = 0.0;
    let mut extra_acceleration = 1.0f32;

    if keyboard_input.pressed(KeyCode::Up) {
        movement_factor += 1.0;
        if keyboard_input.pressed(KeyCode::Space) {
            extra_acceleration = 2.0;
        }
    }

    if keyboard_input.pressed(KeyCode::Left) {
        rotation_factor += 1.0;
    }

    if keyboard_input.pressed(KeyCode::Right) {
        rotation_factor -= 1.0;
    }

    let rotation_delta = Quat::from_rotation_z(rotation_factor * velocity.rotational * TIME_STEP);

    transform.rotation *= rotation_delta;

    // forward and backwards translation

    // get the ship's forward vector by applying the current rotation to the ships initial facing vector
    let movement_direction = transform.rotation * Vec3::Y;
    // get the distance the ship will move based on direction, the ship's movement speed and delta time
    let movement_distance = movement_factor * velocity.linear * extra_acceleration * TIME_STEP;
    // create the change in translation using the new movement direction and distance
    let translation_delta = movement_direction * movement_distance;
    // update the ship translation with our new translation delta
    // bound the ship within the invisible level bounds
    let extents = Vec3::from((BOUNDS / 2.0, 0.0));

    transform.translation += translation_delta;

    transform.translation = transform.translation.clamp(-extents, extents);

    // send message about ship translation
    player_moved_events.send(PlayerMoved {
        pos: transform.translation,
        rot: transform.rotation,
    });
}

fn on_player_moved_system(mut events: EventReader<PlayerMoved>) {
    for movement_event in events.iter() {
        // on each player move push the new position to js over the wasm-bounded thread
        LOCAL_PLAYER_POSITION.with(|pos| {
            pos.borrow_mut()
                .from_game_vector(movement_event.pos, movement_event.rot);
        });
    }
}

fn entity_added(
    time: Res<Time>,
    commands: Commands,
) {
    GAME_ENTITY_UPDATE.with(|entities_update| {
        for entity in entities_update.borrow_mut().iter() {
            let this: JsValue = entity.into();
            let property_key = JsValue::from("uuid");
            let orig_func = Reflect::get(&this, &property_key).unwrap();
            //let func = orig_func.bind(&this);
            info!("NET ENTITY UUID {:?} ", &orig_func);
        }

        // compare to game state
        /*
        match operation {
            "add" => { match kind ... }
            "remove" => { match kind ... }
            "update" => { match kind ... }
        }
        */
        // spawn a new [player]/[token] etc.
        //... or
        // ... update [player]/[token] etc.
    });
}

fn change_color(
    time: Res<Time>,
    mut query: Query<&mut Sprite>,
) {
    for mut sprite in query.iter_mut() {
        sprite
            .color
            .set_b((time.seconds_since_startup() * 20.5).sin() as f32 + 2.0);
    }
}
