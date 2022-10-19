use bevy::{prelude::*, time::FixedTimestep};

use crate::{
    components::{LocalPlayer, Movable, SpriteSize, Velocity},
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
            SystemSet::new()
                .with_run_criteria(FixedTimestep::step(TIME_STEP as f64))
                .with_system(player_movement_system)
                .with_system(on_player_moved_system),
        );
        //app.add_system(player_movement_system);
        //app.add_system(on_player_moved_system);
    }
}

fn player_spawn_system(
    mut commands: Commands,
    game_textures: Res<GameTextures>,
) {
    // get texture for local player
    let player_texture = game_textures.player.get(&1).cloned().unwrap();

    commands
        .spawn_bundle(SpriteBundle {
            texture: player_texture,
            transform: Transform {
                translation: Vec3::new(0., 0., 0.),
                rotation: Quat::from_rotation_z(0.),
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

fn player_movement_system(
    time: Res<Time>,
    mut player_moved_events: EventWriter<PlayerMoved>,
    keyboard_input: Res<Input<KeyCode>>,
    mut query: Query<(&Velocity, &mut Transform), With<LocalPlayer>>,
) {
    let (velocity, mut transform) = query.single_mut();

    // ship rotation
    let mut rotation_factor = 0.0;

    if keyboard_input.pressed(KeyCode::Left) {
        rotation_factor += 1.0;
    }

    if keyboard_input.pressed(KeyCode::Right) {
        rotation_factor -= 1.0;
    }

    let rotation_delta = Quat::from_rotation_z(rotation_factor * velocity.rotational * TIME_STEP);
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

fn on_player_moved_system(mut events: EventReader<PlayerMoved>) {
    for movement_event in events.iter() {
        // on each player move push the new position to js over the wasm-bounded thread
        LOCAL_PLAYER_POSITION.with(|pos| {
            pos.borrow_mut()
                .from_game_vector(movement_event.pos, movement_event.rot);
        });
    }
}
