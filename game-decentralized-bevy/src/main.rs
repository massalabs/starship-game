use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};

pub mod components;
pub mod events;

use components::{MassaToken, Player};
use events::PlayerMoved;

// global settings
const TIME_STEP: f32 = 1.0 / 50.0;
const SCREEN_WIDTH: f32 = 1000.0;
const SCREEN_HEIGHT: f32 = 500.0;
const BOUNDS: Vec2 = Vec2::from_array([SCREEN_WIDTH, SCREEN_HEIGHT]);
const LINEAR_MOVEMENT_SPEED: f32 = 60.0; // linear speed in meters per second
const LINEAR_ROTATION_SPEED: f32 = 360.0; // rotation speed in radians per second

fn main() {

    let mut app = App::new();
    app.insert_resource(WindowDescriptor {
        title: "Starship!".to_string(),
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        present_mode: PresentMode::Immediate,
        #[cfg(target_arch = "wasm32")]
        canvas: Some(String::from("#game")),
        ..Default::default()
    });
    app.add_plugins(DefaultPlugins);
    app.add_event::<PlayerMoved>();
    app.insert_resource(
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .unwrap(),
    );
    app.add_startup_system(setup)
        .add_system_set(
            SystemSet::new()
                .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
                .with_system(update_virtual_input)
                .with_system(on_player_moved)
                //.with_system(render_tokens)
                //.with_system(fire_controller)
                //.with_system(on_bullet_fired)
                //.with_system(update_external_path),
        )
        .run();
}

fn setup(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {

    let galaxy_handle = asset_server.load("entities/galaxy.png");
    let ship_handle = asset_server.load("entities/ship_64x64.png");

    // 2D orthographic camera
    commands.spawn_bundle(Camera2dBundle::default());

    // add galaxy background
    commands.spawn_bundle(SpriteBundle {
        texture: galaxy_handle,
        ..default()
    });

    // player controlled ship
    commands
        .spawn_bundle(SpriteBundle {
            texture: ship_handle,
            ..Default::default()
        })
        .insert(Player {
            movement_speed: LINEAR_MOVEMENT_SPEED, // metres per second
            rotation_speed: f32::to_radians(LINEAR_ROTATION_SPEED), // degrees per second
        });
}

fn update_virtual_input(
    time: Res<Time>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&mut Player, &mut Transform)>,
) {
    let (mut ship, mut transform) = query.single_mut();

    // ship rotation
    let mut rotation_factor = 0.0;
    let mut movement_factor = 0.0;

    if keyboard_input.pressed(KeyCode::Up) {
        movement_factor += 1.0;
    }

    if keyboard_input.pressed(KeyCode::Left) {
        rotation_factor += 1.0;
    }

    if keyboard_input.pressed(KeyCode::Right) {
        rotation_factor -= 1.0;
    }

    let rotation_delta = Quat::from_rotation_z(rotation_factor * ship.rotation_speed * TIME_STEP);

    transform.rotation *= rotation_delta;

    // forward and backwards translation

    // get the ship's forward vector by applying the current rotation to the ships initial facing vector
    let movement_direction = transform.rotation * Vec3::Y;
    // get the distance the ship will move based on direction, the ship's movement speed and delta time
    let movement_distance = movement_factor * ship.movement_speed * TIME_STEP;
    // create the change in translation using the new movement direction and distance
    let translation_delta = movement_direction * movement_distance;
    // update the ship translation with our new translation delta
    // bound the ship within the invisible level bounds
    let extents = Vec3::from((BOUNDS / 2.0, 0.0));

    transform.translation += translation_delta;

    transform.translation = transform.translation.clamp(-extents, extents);


    // print info event
    //info!(
    //    "virtual direction [X/Y]: {:?} @ {:?}",
    //    ship.virtual_x, ship.virtual_y
    //);

    // send message about ship translation
    player_moved_events.send(PlayerMoved {
        pos: transform.translation,
        rot: transform.rotation,
    });
}

fn on_player_moved(mut events: EventReader<PlayerMoved>) {
    for movement_event in events.iter() {
        info!("on_player_virtually_moved X/Y: {:?}---{:?}", movement_event.pos, movement_event.rot);
        /*
        VIRTUAL_GAME_POSITION.with(|pos| {
            pos.borrow_mut()
                .set_coors(movement_event.x, movement_event.y);
        });
        */
    }
}

