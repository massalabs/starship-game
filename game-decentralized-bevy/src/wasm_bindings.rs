use std::cell::RefCell;
use bevy::prelude::{Vec3, Quat};
use wasm_bindgen::prelude::*;


/// Local single thread to represent the player movement
thread_local!(pub static VIRTUAL_GAME_POSITION: RefCell<Position> = RefCell::new(Position{x: 0.0, y: 0.0, rot: 0.0}));

#[derive(Debug, Clone, Copy)]
pub struct Position {
    pub x: f32,
    pub y: f32,
    pub rot: f32,
}

impl Position {
    pub fn from_game_vector(
        &mut self,
        pos: Vec3,
        rot: Quat,
    ) {
        self.x = pos.x;
        self.y = pos.y;
        self.rot = rot.z;
    }
}

#[wasm_bindgen]
pub fn get_x() -> f32 {
    let x_coordinate = VIRTUAL_GAME_POSITION.with(|pos| pos.borrow().x);
    x_coordinate
}

#[wasm_bindgen]
pub fn get_y() -> f32 {
    let y_coordinate = VIRTUAL_GAME_POSITION.with(|pos| pos.borrow().y);
    y_coordinate
}

#[wasm_bindgen]
pub fn get_rot() -> f32 {
    let rotation = VIRTUAL_GAME_POSITION.with(|pos| pos.borrow().rot);
    rotation
}

// ========================================================================================== //

/// local thread to represent the injected game tokens
thread_local!(pub static GAME_TOKENS: RefCell<Vec<Token>> = RefCell::new(Vec::new()));

#[derive(Debug, Clone)]
pub struct Token {
    pub uuid: String,
    pub x: f32,
    pub y: f32,
    pub val: u32,
}

/*
#[wasm_bindgen]
pub fn update_tokens(
    tokens: Vec<Token>,
) {
    info!("Updating game tokens!");
    GAME_TOKENS.with(|pos| {
        pos.borrow_mut().clear();
        pos.borrow_mut().extend_from_slice(&tokens);
    });
}
*/
