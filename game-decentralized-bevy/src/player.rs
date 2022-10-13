use bevy::{prelude::*, time::FixedTimestep};

use crate::{
    components::{Blockchainable, Identifyable, LocalPlayer, Movable, SpriteSize, Velocity},
    events::PlayerMoved,
    resources::GameTextures,
    wasm::LOCAL_PLAYER_POSITION,
    BOUNDS, LINEAR_MOVEMENT_SPEED, LINEAR_ROTATION_SPEED, PLAYER_SIZE, TIME_STEP,
};

pub struct PlayerPlugin;

impl Plugin for PlayerPlugin {
    fn build(
        &self,
        app: &mut App,
    ) {
        app.add_event::<PlayerMoved>();

        app.add_startup_system_to_stage(StartupStage::PostStartup, player_spawn_system);

        app.add_system_set(
            SystemSet::new().with_run_criteria(FixedTimestep::step(TIME_STEP as f64)), //.with_system(player_spawn_system),
        );
        app.add_system(player_movement_system);
        app.add_system(on_player_moved_system);
    }
}

fn player_spawn_system(
    mut commands: Commands,
    game_textures: Res<GameTextures>,
) {
    let player_texture = game_textures.player.clone();

    commands
        .spawn_bundle(SpriteBundle {
            texture: player_texture,
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

    // send message about player translation
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
