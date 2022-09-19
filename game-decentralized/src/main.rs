mod entities;
mod massa;
mod messages;
mod near;
mod utils;

use entities::{CollectibleToken, PlayerState};
use macroquad::prelude::*;
use macroquad::Window;
use massa::{poll_contract_events, ExtendedEventFilter, MassaClient, PollResult};
use massa_models::address::Address;
use massa_models::api::EventFilter;
use messages::{GameStatus, UpdateState};
use utils::draw_box;
use utils::vec2_from_angle;

use std::str::FromStr;
use std::sync::mpsc::{channel, Receiver};
use std::sync::Arc;
use std::thread;

/*
use massa_signature::KeyPair;

let keypair = KeyPair::generate();
let address = Address::from_public_key(&keypair.get_public_key());
let a = address.to_string();
let b = Address::from_str(&a).unwrap();
*/

const EVENT_KEY: &'static str = "GAME_TOKENS_STATE_UPDATED";
const GAME_SC_ADDRESS: &'static str = "A1E3fS4FdHatY7pYeZQ1x7sxApdgQv5eYiW4RH6P1ES7mJG34p4";

const ROT_SPEED: f32 = 0.015;
const LIN_SPEED: f32 = 1.0;
const SPEED_ACCEL_FACTOR: f32 = 3.0;
const MAX_COLLECTIBLES_ON_SCREEN: usize = 10;

pub struct Game {
    pub quit: bool,
    pub player_texture: Texture2D,
    pub collectible_texture: Texture2D,
    pub player_state: PlayerState,
    pub collectible_states: Vec<CollectibleToken>,
}

impl Game {
    pub async fn new(
        initial_player_state: PlayerState,
        initial_collectible_states: Vec<CollectibleToken>,
    ) -> Self {
        let player_texture = load_texture("assets/plane.png").await.unwrap();
        let collectible_texture = load_texture("assets/massa-token-small.png").await.unwrap();
        info!("Player and Collectible Textures loaded");

        Self {
            quit: false,
            player_texture,
            collectible_texture,
            player_state: initial_player_state,
            collectible_states: initial_collectible_states,
        }
    }

    pub fn update(
        &mut self,
        update_state: Option<UpdateState>,
    ) {
        // match the update message
        if let Some(update_state) = update_state {
            match update_state {
                UpdateState::Collectibles(new_collectibles_state) => {
                    info!("New Collectibles {:?}", new_collectibles_state.len());
                    if new_collectibles_state.len() == MAX_COLLECTIBLES_ON_SCREEN {
                        // new correct socket update
                        self.collectible_states = new_collectibles_state;
                    }
                }
            }
        }

        if is_key_down(KeyCode::Escape) {
            self.quit = true;
        }
        if is_key_down(KeyCode::Right) {
            self.player_state.rotation += ROT_SPEED;
        }
        if is_key_down(KeyCode::Left) {
            self.player_state.rotation -= ROT_SPEED;
        }

        if is_key_down(KeyCode::Up) {
            if is_key_down(KeyCode::Space) {
                self.player_state.position +=
                    vec2_from_angle(self.player_state.rotation) * SPEED_ACCEL_FACTOR * LIN_SPEED;
            } else {
                self.player_state.position +=
                    vec2_from_angle(self.player_state.rotation) * LIN_SPEED;
            }
        }

        // update player position
        //self.player_state.position += vec2_from_angle(self.player_state.rotation) * SPEED;

        // bound player to the screen box
        if self.player_state.position.x > screen_width() {
            self.player_state.position.x = -self.player_texture.width();
        } else if self.player_state.position.x < -self.player_texture.width() {
            self.player_state.position.x = screen_width();
        }

        if self.player_state.position.y > screen_height() {
            self.player_state.position.y = -self.player_texture.height();
        } else if self.player_state.position.y < -self.player_texture.height() {
            self.player_state.position.y = screen_height();
        }
    }

    pub fn draw(&self) {
        // white screen
        clear_background(color_u8!(255, 255, 255, 255));

        // draw title
        draw_text("Starship", 300f32, 100f32, 50f32, GREEN);

        // draw the black obstacle box
        draw_box(Vec2::new(400f32, 200f32), Vec2::new(50f32, 20f32));

        // draw the collectibles state
        for collectible_state in self.collectible_states.iter() {
            draw_texture_ex(
                self.collectible_texture,
                collectible_state.x,
                collectible_state.y,
                WHITE,
                DrawTextureParams {
                    rotation: 0.0,
                    ..Default::default()
                },
            );
        }

        // draw the moving object
        draw_texture_ex(
            self.player_texture,
            self.player_state.position.x,
            self.player_state.position.y,
            WHITE,
            DrawTextureParams {
                rotation: self.player_state.rotation,
                ..Default::default()
            },
        );
    }
}

#[tokio::main(worker_threads = 1)]
async fn main() {
    // create a channel to communicate between game and blockchain
    let (chain_tx, chain_rx) = channel::<PollResult>();
    let (game_status_tx, game_status_rx) = channel::<GameStatus>();

    // create massa rpc client
    let massa_client = MassaClient::new_testnet().await;
    game_status_tx.send(GameStatus::MassaConnected).unwrap();

    // TODO: check if player is registered or not, evtl. register
    let initial_player_state = PlayerState {
        id: "uuid-1234".to_string(),
        position: Vec2::new(0f32, 0f32),
        rotation: 0f32,
    };
    let initial_collectible_states = Vec::new();
    game_status_tx.send(GameStatus::PlayerRegistered).unwrap();

    // create events filter
    let event_extended_filter = ExtendedEventFilter {
        event_regex: Some(vec![EVENT_KEY.into()]), // enum all events we are interested in collecting
        event_filter: EventFilter {
            start: None,
            end: None,
            emitter_address: Some(Address::from_str(GAME_SC_ADDRESS).unwrap()), // game address
            original_caller_address: None,
            original_operation_id: None,
            is_final: Some(true), // poll only final events
        },
    };
    // start polling massa sc for events in a separate tokio thread
    let massa_client = Arc::new(massa_client);
    poll_contract_events(massa_client, event_extended_filter, chain_tx).await;
    game_status_tx
        .send(GameStatus::ServerStreamingStarted)
        .unwrap();

    // spawn the game in a separate none-tokio thread
    let game_single_thread_handle = thread::spawn(move || {
        Window::from_config(
            Conf {
                sample_count: 4,
                window_title: "Starship".to_string(),
                high_dpi: true,
                ..Default::default()
            },
            run_game(
                initial_player_state,
                initial_collectible_states,
                chain_rx,
                game_status_rx,
            ),
        );
    });

    // join the game to main tokio thread
    game_status_tx.send(GameStatus::Started).unwrap();
    game_single_thread_handle.join().unwrap();
}

async fn run_game(
    initial_player_state: PlayerState,
    initial_collectible_states: Vec<CollectibleToken>,
    chain_rx: Receiver<PollResult>,
    game_status_rx: Receiver<GameStatus>,
) {
    let mut game = Game::new(initial_player_state, initial_collectible_states).await;

    loop {
        // receive and process external game messages
        let game_status_msg = game_status_rx.try_recv().ok();
        if let Some(game_msg) = game_status_msg {
            match game_msg {
                GameStatus::MassaConnected => {
                    info!("Connected to Massa!")
                }
                GameStatus::ServerStreamingStarted => {
                    info!("Server streaming Started!")
                }
                GameStatus::PlayerRegistered => {
                    info!("Player Registered on Massa!")
                }
                GameStatus::Started => {
                    info!("Game Started!")
                }
                _ => {
                    info!("Unknown Message!")
                }
            }
        }

        // receive and process chain messages
        let chain_msg = chain_rx.try_recv().ok();

        let update = chain_msg.and_then(|poll_result| match poll_result {
            PollResult::Events(poll_result) => {
                let collectible_token_update = poll_result
                    .iter()
                    .filter_map(|event| {
                        if event.data.contains(EVENT_KEY) {
                            let event_parts: Vec<&str> = event.data.split("=").collect();
                            let event_data = event_parts[1].to_owned();
                            let event_parts: Vec<&str> = event_data.split("@").collect();

                            let tokens = event_parts
                                .iter()
                                .map(|&e| {
                                    let token =
                                        serde_json::from_slice::<CollectibleToken>(e.as_bytes());
                                    token
                                })
                                .collect::<Result<Vec<CollectibleToken>, _>>()
                                .ok();

                            return tokens;
                        }
                        None
                    })
                    .flatten()
                    .collect::<Vec<CollectibleToken>>();

                Some(UpdateState::Collectibles(collectible_token_update))
            }
            PollResult::Error(e) => {
                info!("Received error ? {:?}", e);
                None
            }
        });

        game.update(update);
        game.draw();
        if game.quit {
            return;
        }
        next_frame().await;
    }
}
