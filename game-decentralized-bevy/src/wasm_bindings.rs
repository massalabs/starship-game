use bevy::prelude::*;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

impl Position {
    pub fn set_coors(
        &mut self,
        x: f32,
        y: f32,
    ) {
        self.x = x;
        self.y = y;
    }
}

#[derive(Debug, Clone)]
pub struct Token {
    pub uuid: String,
    pub x: f32,
    pub y: f32,
}

impl Token {
    pub fn create(
        &mut self,
        uuid: String,
        x: f32,
        y: f32,
    ) {
        self.uuid = uuid;
        self.x = x;
        self.y = y;
    }
}

thread_local!(pub static USER_DESIRED_POSITION: RefCell<Position> = RefCell::new(Position{x: 0.0, y: 0.0}));
thread_local!(pub static VIRTUAL_GAME_POSITION: RefCell<Position> = RefCell::new(Position{x: 0.0, y: 0.0}));
thread_local!(pub static GAME_TOKENS: RefCell<Vec<Token>> = RefCell::new(Vec::new()));

#[wasm_bindgen]
pub fn get_x() -> f32 {
    let coords = VIRTUAL_GAME_POSITION.with(|pos| pos.borrow().x);
    coords
}

#[wasm_bindgen]
pub fn get_y() -> f32 {
    let coords = VIRTUAL_GAME_POSITION.with(|pos| pos.borrow().y);
    coords
}

#[wasm_bindgen]
pub fn set_user_desired_position(
    x: f32,
    y: f32,
) {
    info!("Setting user desired position! {:?}:{:?}", x, y);
    USER_DESIRED_POSITION.with(|pos| {
        pos.borrow_mut().set_coors(x, y);
    });
}

#[wasm_bindgen]
pub fn set_user_virtual_position(
    x: f32,
    y: f32,
) {
    info!("Setting user virtual position! {:?}:{:?}", x, y);
    VIRTUAL_GAME_POSITION.with(|pos| {
        pos.borrow_mut().set_coors(x, y);
    });
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
