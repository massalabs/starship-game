use bevy::prelude::{Quat, Vec3};
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Local single thread recording player movements on every frame RUST -> JS
thread_local!(pub static LOCAL_PLAYER_POSITION: RefCell<Position> = RefCell::new(Position{x: 0.0, y: 0.0, rot: 0.0, w: 0.0}));

#[derive(Debug, Clone, Copy)]
pub struct Position {
    pub x: f32,
    pub y: f32,
    pub rot: f32,
    pub w: f32,
}

impl Position {
    pub fn from_game_vector(
        &mut self,
        pos: Vec3,
        rot: Quat,
    ) {
        //let (vec, angle) = rot.to_axis_angle();
        self.x = pos.x;
        self.y = pos.y;
        self.rot = rot.z;
        self.w = rot.w;
    }

    pub fn set_pos(
        &mut self,
        x: f32,
        y: f32,
        rot: f32,
        w: f32,
    ) {
        self.x = x;
        self.y = y;
        self.rot = rot;
        self.w = w;
    }
}

// a method callable from js to get player x position
#[wasm_bindgen]
pub fn get_player_x() -> f32 {
    let x_coordinate = LOCAL_PLAYER_POSITION.with(|pos| pos.borrow().x);
    x_coordinate
}

// a method callable from js to get player y position
#[wasm_bindgen]
pub fn get_player_y() -> f32 {
    let y_coordinate = LOCAL_PLAYER_POSITION.with(|pos| pos.borrow().y);
    y_coordinate
}

// a method callable from js to get player rotation
#[wasm_bindgen]
pub fn get_player_rot() -> f32 {
    let rotation = LOCAL_PLAYER_POSITION.with(|pos| pos.borrow().rot);
    rotation
}

#[wasm_bindgen]
pub fn get_player_w() -> f32 {
    let rotation = LOCAL_PLAYER_POSITION.with(|pos| pos.borrow().w);
    rotation
}

// ========================================================================================== //

// A JS < -- > RUST mapped object
#[wasm_bindgen(module = "src/app/GameEntity.ts")]
extern "C" {
    #[derive(Debug)]
    pub type GameEntityUpdate;

    #[wasm_bindgen(constructor)]
    fn new_player(
        operation: String,
        data: String,
    ) -> GameEntityUpdate;

    // --------OPERATION--------------- //
    #[wasm_bindgen(method, setter, js_name = set_operation)]
    fn set_operation(
        this: &GameEntityUpdate,
        value: String,
    ); // add, remove, update

    #[wasm_bindgen(method, getter, js_name = get_operation)]
    fn get_operation(this: &GameEntityUpdate) -> String;

    // --------DATA--------------- //
    #[wasm_bindgen(method, setter, js_name = set_data)]
    fn set_data(
        this: &GameEntityUpdate,
        value: String,
    );

    #[wasm_bindgen(method, getter, js_name = get_data)]
    fn get_data(this: &GameEntityUpdate) -> String;
}

// local communication thread between js and the game engine [JS (write) --> RUST game loop (read)]
thread_local!(pub static GAME_ENTITY_UPDATE: RefCell<Vec<GameEntityUpdate>> = RefCell::new(vec![]));

// JS call to set a vec of updates which the game engine (rust) needs to process
#[wasm_bindgen]
pub fn push_game_entity_updates(updated_entities: Vec<GameEntityUpdate>) {
    GAME_ENTITY_UPDATE.with(|pos| {
        //let entities_updated = updated_entities.len();
        pos.borrow_mut().extend(updated_entities.into_iter());
        /*
        log(format!(
            "Entities updated {:?}. Queue size: {:?}",
            entities_updated,
            pos.borrow().len()
        )
        .as_str());
        */
    });
}
