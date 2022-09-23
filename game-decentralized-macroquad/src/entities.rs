use macroquad::prelude::Vec2;
use massa_models::address::Address;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEventOnchain {
    pub data: String,
    pub time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectibleToken {
    pub uuid: String,
    pub x: f32,
    pub y: f32,
    pub cbox: f32,
    pub value: u64,
}

#[derive(Debug, Clone)]
pub struct PlayerState {
    pub id: String,
    pub address: Address,
    pub position: Vec2,
    pub rotation: f32,
    pub cbox: f32,
    pub tokensCollected: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerEntityOnchain {
    pub uuid: String,
    pub address: String,
    pub x: f32,
    pub y: f32,
    pub rot: f32,
    pub cbox: f32,
    pub tokensCollected: u64,
}