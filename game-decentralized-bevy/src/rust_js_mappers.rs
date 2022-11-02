use js_sys::{Array, Function, Map, Object, Reflect, WebAssembly};
use wasm_bindgen::{JsCast, JsValue};

use crate::errors::ClientError;
use crate::events::{
    PLAYER_ADDED, PLAYER_MOVED, PLAYER_REMOVED, TOKEN_ADDED, TOKEN_COLLECTED, TOKEN_REMOVED,
};
use crate::resources::{
    CollectedEntity, EntityType, RemoteCollectibleState, RemoteGamePlayerState, RemoteStateType,
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

// ==============================

pub fn map_js_update_to_rust_entity_state(
    entity: GameEntityUpdate
) -> Result<Option<RemoteStateType>, ClientError> {
    let js_obj: JsValue = entity.into();

    //  we can safely unwrap all options as we know that none-existing js values will be marked as JsValue::unedefined
    let operation = get_key_value_from_obj::<String>("operation", &js_obj)
        .ok_or(ClientError::MissingOperationKey)?;

    match operation.as_str() {
        PLAYER_ADDED | PLAYER_MOVED | PLAYER_REMOVED => {
            info!("PLAYER ACTION {:?} ", operation.as_str());
            let player_state = RemoteGamePlayerState {
                uuid: get_key_value_from_obj::<String>("uuid", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("uuid".to_owned()))?,
                address: get_key_value_from_obj::<String>("address", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("address".to_owned()))?,
                name: get_key_value_from_obj::<String>("name", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("name".to_owned()))?,
                position: Vec3::new(
                    get_key_value_from_obj::<f64>("x", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("x".to_owned()))?
                        as f32,
                    get_key_value_from_obj::<f64>("y", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("y".to_owned()))?
                        as f32,
                    0.0f32,
                ),
                rotation: Quat::from_array([
                    0.,
                    0.,
                    get_key_value_from_obj::<f64>("rot", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("rot".to_owned()))?
                        as f32,
                    get_key_value_from_obj::<f64>("w", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("w".to_owned()))?
                        as f32,
                ]),
                r#type: map_type(
                    &get_value_for_key("type", &js_obj).expect("Some type to be present"),
                ),
            };

            match operation.as_str() {
                PLAYER_ADDED => Ok(Some(RemoteStateType::PlayerAdded(player_state))),
                PLAYER_MOVED => Ok(Some(RemoteStateType::PlayerMoved(player_state))),
                PLAYER_REMOVED => Ok(Some(RemoteStateType::PlayerRemoved(player_state))),
                _ => Err(ClientError::UnknownOperationReceived),
            }
        }
        TOKEN_ADDED | TOKEN_REMOVED => {
            info!("TOKEN ACTION {:?} ", operation.as_str());
            let token_state = RemoteCollectibleState {
                uuid: get_key_value_from_obj::<String>("uuid", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("uuid".to_owned()))?,
                position: Vec3::new(
                    get_key_value_from_obj::<f64>("x", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("x".to_owned()))?
                        as f32,
                    get_key_value_from_obj::<f64>("y", &js_obj)
                        .ok_or(ClientError::UnparsableKeyValueJsValue("y".to_owned()))?
                        as f32,
                    0.0f32,
                ),
            };
            match operation.as_str() {
                TOKEN_ADDED => Ok(Some(RemoteStateType::TokenAdded(token_state))),
                TOKEN_REMOVED => Ok(Some(RemoteStateType::TokenRemoved(token_state))),
                _ => Err(ClientError::UnknownOperationReceived),
            }
        }
        TOKEN_COLLECTED => {
            let res = Ok(Some(RemoteStateType::TokenCollected(CollectedEntity {
                uuid: get_key_value_from_obj::<String>("uuid", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("uuid".to_owned()))?,
                player_uuid: get_key_value_from_obj::<String>("playerUuid", &js_obj).ok_or(
                    ClientError::UnparsableKeyValueJsValue("playerUuid".to_owned()),
                )?,
                value: get_key_value_from_obj::<f64>("value", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("value".to_owned()))?,
                time: get_key_value_from_obj::<f64>("time", &js_obj)
                    .ok_or(ClientError::UnparsableKeyValueJsValue("time".to_owned()))?,
            })));
            info!("TOKEN COLLECTED {:?} ", res);
            res
        }
        _ => return Ok(None),
    }
}
