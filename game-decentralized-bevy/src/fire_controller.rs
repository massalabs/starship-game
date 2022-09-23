use bevy::window::PresentMode;
use bevy::{core::FixedTimestep, math::const_vec2, prelude::*};
use bevy_rapier2d::prelude::*;
use bevy_rapier2d::rapier::prelude::{RigidBodyActivation, RigidBodyForces};

use crate::components::{Materials, Player};

pub struct BulletFiredEvent {
    pub position: Vec2,
    //pub direction: GameDirection,
}

pub fn fire_controller(
    time: Res<Time>,
    keyboard_input: Res<Input<KeyCode>>,
    mut send_fire_event: EventWriter<BulletFiredEvent>,
    players: Query<(&mut Player, &mut Transform)>,
) {
    if keyboard_input.just_pressed(KeyCode::Space) {
        for (player, position) in players.iter() {
            let event = BulletFiredEvent {
                position: Vec2::new(position.translation.x, position.translation.y),
                //direction: player.facing_direction,
            };
            send_fire_event.send(event);
        }
    }
}

pub fn on_bullet_fired(
    mut commands: Commands,
    materials: &Res<Materials>,
    mut bullet_fired_events: EventReader<BulletFiredEvent>,
) {
    for event in bullet_fired_events.iter() {
        //insert_bullet_at(&mut commands, &materials, event)
        info!(
            "============ bullet fired ============ {:?}",
            event.position
        );
    }
}

/*
pub fn insert_bullet_at(
    commands: &mut Commands,
    materials: &Res<Materials>,
    options: &BulletFiredEvent,
) {
    let speed = match options.direction {
        GameDirection::Left => -14.0,
        _ => 14.0,
    };

    let x = match options.direction {
        GameDirection::Left => options.position.x - 1.,
        _ => options.position.x + 1.,
    };
    let rigid_body = RigidBodyBundle {
        position: Vec2::new(x, options.position.y).into(),
        velocity: RigidBodyVelocity {
            linvel: Vec2::new(speed, 0.0).into(),
            ..Default::default()
        }.into(),
        mass_properties: RigidBodyMassPropsFlags::ROTATION_LOCKED.into(),
        activation: RigidBodyActivation::cannot_sleep().into(),
        forces: RigidBodyForces {
            gravity_scale: 0.,
            ..Default::default()
        }.into(),
        ..Default::default()
    };

    let collider = ColliderBundle {
        shape: ColliderShape::cuboid(0.25, 0.05).into(),
        flags: ColliderFlags {
            active_events: ActiveEvents::CONTACT_EVENTS,
            ..Default::default()
        }.into(),
        ..Default::default()
    };

    let sprite = SpriteBundle {
        sprite: Sprite {
            color: materials.bullet_material.clone(),
            custom_size: Vec2::new(0.5, 0.1).into(),
            ..Default::default()
        },
        ..Default::default()
    };

    commands
        .spawn_bundle(sprite)
        .insert_bundle(rigid_body)
        .insert_bundle(collider)
        .insert(RigidBodyPositionSync::Discrete)
        .insert(Bullet);
}
*/
