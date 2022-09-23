use bevy::window::PresentMode;
use bevy::{core::FixedTimestep, math::const_vec2, prelude::*};

pub mod components;
pub mod events;
pub mod fire_controller;
pub mod wasm_bindings;

use components::{MassaToken, Player};
use events::PlayerVirtuallyMoved;
use fire_controller::{fire_controller, on_bullet_fired, BulletFiredEvent};
use wasm_bindings::{USER_DESIRED_POSITION, VIRTUAL_GAME_POSITION};

// global settings
const TIME_STEP: f32 = 1.0 / 50.0;
const SCREEN_WIDTH: f32 = 1000.0;
const SCREEN_HEIGHT: f32 = 500.0;
const BOUNDS: Vec2 = const_vec2!([SCREEN_WIDTH, SCREEN_HEIGHT]);
const LINEAR_MOVEMENT_SPEED: f32 = 6000.0; // linear speed in meters per second
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
    app.add_event::<PlayerVirtuallyMoved>();
    app.add_event::<BulletFiredEvent>();
    app.add_startup_system(setup)
        .add_system_set(
            SystemSet::new()
                .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
                .with_system(update_virtual_input)
                .with_system(on_player_virtually_moved)
                .with_system(render_tokens)
                //.with_system(fire_controller)
                //.with_system(on_bullet_fired)
                .with_system(update_external_path),
        )
        .add_system(bevy::input::system::exit_on_esc_system)
        .run();
}

fn setup(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    commands.insert_resource(components::Materials {
        bullet_material: Color::rgb(0.8, 0.8, 0.).into(),
    });

    let galaxy_handle = asset_server.load("entities/galaxy.png");
    let ship_handle = asset_server.load("entities/ship_64x64.png");

    // 2D orthographic camera
    commands.spawn_bundle(OrthographicCameraBundle::new_2d());

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
            virtual_x: 0.0,                        // virtual x position
            virtual_y: 0.0,                        // virtual y position
        });
}

fn update_virtual_input(
    time: Res<Time>,
    mut player_moved_events: EventWriter<PlayerVirtuallyMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&mut Player, &mut Transform)>,
) {
    let (mut ship, mut transform) = query.single_mut();

    // ship rotation
    let mut rotation_factor = 0.0;
    let mut movement_factor = 0.0;

    if keyboard_input.just_released(KeyCode::Up) {
        movement_factor += 1.0;
    }

    if keyboard_input.just_released(KeyCode::Down) {
        movement_factor -= 1.0;
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
    ship.virtual_x += translation_delta.x;
    if ship.virtual_x < -extents.x {
        ship.virtual_x = -extents.x;
    }
    if ship.virtual_x > extents.x {
        ship.virtual_x = extents.x;
    }
    ship.virtual_y += translation_delta.y;
    if ship.virtual_y < -extents.y {
        ship.virtual_y = -extents.y;
    }
    if ship.virtual_y > extents.y {
        ship.virtual_y = extents.y;
    }

    // print info event
    //info!(
    //    "virtual direction [X/Y]: {:?} @ {:?}",
    //    ship.virtual_x, ship.virtual_y
    //);

    // send message about ship translation
    player_moved_events.send(PlayerVirtuallyMoved {
        x: ship.virtual_x,
        y: ship.virtual_y,
    });
}

fn on_player_virtually_moved(mut events: EventReader<PlayerVirtuallyMoved>) {
    for movement_event in events.iter() {
        //info!("on_player_virtually_moved X/Y: {:?}---{:?}", movement_event.x, movement_event.y);
        VIRTUAL_GAME_POSITION.with(|pos| {
            pos.borrow_mut()
                .set_coors(movement_event.x, movement_event.y);
        });
    }
}

fn render_tokens(
    mut commands: Commands,
    time: Res<Time>,
    asset_server: Res<AssetServer>,
    mut query: Query<(&mut MassaToken, &mut Transform)>,
) {
    let token_handle = asset_server.load("entities/token.png");
    commands
        .spawn_bundle(SpriteBundle {
            texture: token_handle,
            transform: Transform::from_xyz(50., 50., 0.),
            ..Default::default()
        })
        .insert(MassaToken);
}

fn update_external_path(
    time: Res<Time>,
    commands: Commands,
    mut sprite_position: Query<(&mut Player, &mut Transform)>,
) {
    USER_DESIRED_POSITION.with(|pos| {
        let extents = Vec3::from((BOUNDS / 2.0, 0.0));

        let direction = Vec3::new(pos.borrow().x, pos.borrow().y, 0.0);

        for (mut player, mut transform) in sprite_position.iter_mut() {
            //info!("update_external_path [X/Y]: {:?} @ {:?}", transform.translation.x, transform.translation.y);

            let mut xx = direction - transform.translation;

            let denom = (xx.x * xx.x + xx.y * xx.y).sqrt();
            if denom > 0.0 {
                xx.x = xx.x / denom;
                xx.y = xx.y / denom;
            }

            if (transform.translation.x - pos.borrow().x).abs() > 1.0
                || (transform.translation.y - pos.borrow().y).abs() > 1.0
            {
                transform.translation += xx * player.movement_speed * TIME_STEP;
                transform.translation = transform.translation.min(extents).max(-extents);

                player.virtual_x = transform.translation.x;
                player.virtual_y = transform.translation.y;
            }
        }
    });
}
