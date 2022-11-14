use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use wasm_bindgen::{JsCast, JsValue};

use crate::errors::ClientError;
use crate::events::{
    CollectedEntityEventData, PlayerLaserEventData, PlayerLaserSerializedData,
    RemoteCollectibleEventData, RemotePlayerEventData, LASERS_SHOT, PLAYER_ADDED, PLAYER_MOVED,
    PLAYER_REMOVED, TOKEN_ADDED, TOKEN_COLLECTED, TOKEN_REMOVED,
};
use crate::resources::{
    CollectedEntity, EntityType, RemoteCollectibleState, RemoteGamePlayerState, RemoteLaserState,
    RemoteStateType,
};
use crate::wasm::GameEntityUpdate;
use anyhow::{Context, Result};
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use bevy::math::Vec3Swizzles;
use bevy::sprite::collide_aabb::collide;
use bevy::utils::HashMap;
use bevy::window::PresentMode;
use bevy::{math::Vec2, prelude::*, time::FixedTimestep};
use std::collections::HashSet;

// ==============================

pub trait JsConvertible {
    fn from_js(value: &JsValue) -> Option<Self>
    where
        Self: Sized;
}

impl JsConvertible for f64 {
    fn from_js(value: &JsValue) -> Option<Self> {
        value.as_f64()
    }
}

impl JsConvertible for String {
    fn from_js(value: &JsValue) -> Option<Self> {
        value.as_string()
    }
}

impl JsConvertible for bool {
    fn from_js(value: &JsValue) -> Option<Self> {
        value.as_bool()
    }
}

pub fn get_value_for_key(
    key: &str,
    object: &JsValue,
) -> Option<JsValue> {
    let key = JsValue::from(key);
    let value = Reflect::get(&object, &key).ok();
    value
}

pub fn get_key_value_from_obj<T>(
    key: &str,
    js_obj: &JsValue,
) -> Option<T>
where
    T: JsConvertible,
{
    get_value_for_key(key, &js_obj)
        .map(|val| {
            if val.is_null() || val.is_undefined() {
                return None;
            }
            JsConvertible::from_js(&val)
        })
        .flatten()
}

pub fn map_type(r#type: &JsValue) -> EntityType {
    return match r#type.as_string().unwrap().as_str() {
        "local" => EntityType::Local,
        "remote" => EntityType::Remote,
        _ => EntityType::Remote,
    };
}

pub fn map_type_from_str(r#type: &str) -> EntityType {
    return match r#type {
        "local" => EntityType::Local,
        "remote" => EntityType::Remote,
        _ => EntityType::Remote,
    };
}

// ==============================

pub fn map_js_update_to_rust_entity_state(
    entity: GameEntityUpdate
) -> Result<Option<RemoteStateType>, ClientError> {
    let js_obj: JsValue = entity.into();

    //  we can safely unwrap all options as we know that none-existing js values will be marked as JsValue::undefined
    let operation = get_key_value_from_obj::<String>("operation", &js_obj)
        .ok_or(ClientError::MissingOperationKey)?;

    match operation.as_str() {
        PLAYER_ADDED | PLAYER_MOVED | PLAYER_REMOVED => {
            //info!("[BEVY] PLAYER ACTION {:?} ", operation.as_str());
            let remote_player_event = get_key_value_from_obj::<String>("data", &js_obj)
                .map(|data| serde_json::from_str::<RemotePlayerEventData>(data.as_str()).ok())
                .flatten()
                .map(|data| RemoteGamePlayerState {
                    uuid: data.uuid,
                    address: data.address,
                    name: data.name,
                    position: Vec3::new(data.x as f32, data.y as f32, 0.0f32),
                    rotation: Quat::from_array([0., 0., data.rot as f32, data.w as f32]),
                    r#type: map_type_from_str(&data.r#type),
                });

            match operation.as_str() {
                PLAYER_ADDED => Ok(remote_player_event.map(RemoteStateType::PlayerAdded)),
                PLAYER_MOVED => Ok(remote_player_event.map(RemoteStateType::PlayerMoved)),
                PLAYER_REMOVED => Ok(remote_player_event.map(RemoteStateType::PlayerRemoved)),
                _ => Err(ClientError::UnknownOperationReceived),
            }
        }
        TOKEN_ADDED | TOKEN_REMOVED => {
            //info!("[BEVY] TOKEN ACTION {:?} ", operation.as_str());
            let collected_entity_event = get_key_value_from_obj::<String>("data", &js_obj)
                .map(|data| serde_json::from_str::<RemoteCollectibleEventData>(data.as_str()).ok())
                .flatten()
                .map(|data| RemoteCollectibleState {
                    uuid: data.uuid,
                    position: Vec3::new(data.x as f32, data.y as f32, 0.0f32),
                });

            match operation.as_str() {
                TOKEN_ADDED => Ok(collected_entity_event.map(RemoteStateType::TokenAdded)),
                TOKEN_REMOVED => Ok(collected_entity_event.map(RemoteStateType::TokenRemoved)),
                _ => Err(ClientError::UnknownOperationReceived),
            }
        }
        TOKEN_COLLECTED => {
            let collected_entity_event = get_key_value_from_obj::<String>("data", &js_obj)
                .map(|data| serde_json::from_str::<CollectedEntityEventData>(data.as_str()).ok())
                .flatten()
                .map(|data| CollectedEntity {
                    uuid: data.uuid,
                    player_uuid: data.player_uuid,
                    value: data.value,
                    time: data.time,
                });

            //info!("[BEVY] TOKEN COLLECTED {:?}", &collected_entity_event);
            return Ok(collected_entity_event.map(RemoteStateType::TokenCollected));
        }
        LASERS_SHOT => {
            let lasers_shot_event = get_key_value_from_obj::<String>("data", &js_obj)
                .map(|data| serde_json::from_str::<PlayerLaserEventData>(data.as_str()).ok())
                .flatten();

            let player_uuid = lasers_shot_event.as_ref()
                .and_then(|data| Some(data.player_uuid.clone()))
                .expect("A valid player uuid");

            let player_lasers = lasers_shot_event
                .map(|f| {
                    f.lasers_data
                        .split("@")
                        .filter_map(|item| {
                            serde_json::from_str::<PlayerLaserSerializedData>(item).ok()
                        })
                        .collect::<Vec<PlayerLaserSerializedData>>()
                })
                .unwrap_or_default();

            //info!("[BEVY] LASERS SHOT EVENT {:?}", &x);
            return Ok(Some(RemoteStateType::LasersShot((
                player_uuid,
                player_lasers,
            ))));
        }
        _ => return Ok(None),
    }
}
