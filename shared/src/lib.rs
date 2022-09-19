//use glam::Vec2;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
pub struct RemoteState {
    pub id: usize,
    pub position: glam::Vec2,
    pub rotation: f32,
}

#[derive(Deserialize, Serialize)]
pub enum ServerMessage {
    Welcome(usize),
    GoodBye(usize),
    Update(Vec<RemoteState>),
}

#[derive(Deserialize, Serialize, Clone)]
pub struct State {
    pub pos: glam::Vec2,
    pub r: f32,
}

#[derive(Deserialize, Serialize)]
pub enum ClientMessage {
    State(State),
}
