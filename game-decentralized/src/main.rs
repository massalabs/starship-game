mod entities;
mod events;
mod massa;
mod messages;
mod near;
mod utils;

use entities::{CollectibleToken, PlayerState};
use entities::{GameEventOnchain, PlayerEntityOnchain};
use events::{
    parse_added_players_events, parse_collectible_events, parse_players_movement_events,
    parse_removed_players_events,
};
use macroquad::prelude::*;
use macroquad::Window;
use massa::{
    generate_thread_addresses_hashmap, poll_contract_events, ExtendedEventFilter, MassaClient,
    PollResult,
};
use massa_models::address::Address;
use massa_models::api::EventFilter;
use messages::{ExecutorToGameMessage, GameToExecutorMessage, OnchainUpdateMessage};
use utils::draw_box;
use utils::vec2_from_angle;

use std::str::FromStr;
use std::sync::mpsc::Sender;
use std::sync::mpsc::{channel, Receiver};
use std::sync::Arc;
use std::thread;

use crate::massa::get_thread_to_execute_from;

lazy_static::lazy_static! {
    pub static ref GAME_SC_ADDRESS: Address = Address::from_str("A12ZufE7mGz6RLt3PCN9dsbLE2bK2kvj8mnDE9ibdCycWPcg3C4z").unwrap();
    pub static ref PLAYER_ADDRESS: Address = Address::from_str("A12CoH9XQzHFLdL8wrXd3nra7iidiYEQpqRdbLtyNXBdLtKh1jvT").unwrap();
}

const GAME_TOKENS_STATE_UPDATED_EVENT_KEY: &'static str = "GAME_TOKENS_STATE_UPDATED";
const PLAYER_MOVED_EVENT_KEY: &'static str = "PLAYER_MOVED";
const PLAYER_ADDED_EVENT_KEY: &'static str = "PLAYER_ADDED";
const PLAYER_REMOVED_EVENT_KEY: &'static str = "PLAYER_REMOVED";
const TOKEN_COLLECTED_EVENT_KEY: &'static str = "TOKEN_COLLECTED";

const ROT_SPEED: f32 = 0.015;
const LIN_SPEED: f32 = 1.0;
const SPEED_ACCEL_FACTOR: f32 = 3.0;
const MAX_COLLECTIBLES_ON_SCREEN: usize = 10;

pub struct Game {
    pub quit: bool,
    pub player_texture: Texture2D,
    pub collectible_texture: Texture2D,
    pub background_texture: Texture2D,
    pub player_state: PlayerState,
    pub players_remote_states: Vec<PlayerState>,
    pub collectible_states: Vec<CollectibleToken>,
}

impl Game {
    pub async fn new(
        initial_player_state: PlayerState,
        initial_collectible_states: Vec<CollectibleToken>,
    ) -> Self {
        let player_texture = load_texture("assets/plane.png").await.unwrap();
        let collectible_texture = load_texture("assets/massa-token-small.png").await.unwrap();
        let background_texture = load_texture("assets/galaxy.png").await.unwrap();
        info!("Player and Collectible Textures loaded");

        Self {
            quit: false,
            player_texture,
            collectible_texture,
            background_texture,
            player_state: initial_player_state,
            players_remote_states: Default::default(),
            collectible_states: initial_collectible_states,
        }
    }

    pub fn update(
        &mut self,
        update_state: Option<Vec<OnchainUpdateMessage>>,
        ch_game_executor_tx: Sender<GameToExecutorMessage>,
    ) {
        // match the onchain update message
        if let Some(update_state) = update_state {
            for update in update_state.into_iter() {
                match update {
                    OnchainUpdateMessage::CollectiblesNewState(collectibles_new_state) => {
                        info!(
                            "Message:: New Collectibles state {:?}",
                            collectibles_new_state.len()
                        );
                        if collectibles_new_state.len() == MAX_COLLECTIBLES_ON_SCREEN {
                            // new correct socket update
                            self.collectible_states.clear();
                            self.collectible_states
                                .extend(collectibles_new_state.into_iter());
                        }
                    }
                    OnchainUpdateMessage::PlayerMovedOnchain(players_moved_onchain) => {
                        if players_moved_onchain.len() > 0 {
                            info!(
                                "Message:: Players moved onchain {:?}",
                                players_moved_onchain.len()
                            );
                        }
                    }
                    OnchainUpdateMessage::PlayerRemovedOnchain(players_addresses) => {
                        if players_addresses.len() > 0 {
                            info!(
                                "Message:: Players removed onchain {:?}",
                                players_addresses.len()
                            );
                        }
                    }
                    OnchainUpdateMessage::PlayerAddedOnchain(player_registered_onchain) => {
                        if player_registered_onchain.len() > 0 {
                            info!(
                                "Message:: Players registered onchain {:?}",
                                player_registered_onchain.len()
                            );
                        }
                    }
                    OnchainUpdateMessage::TokenCollectedOnchain(token_collected_onchain) => {}
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

        ch_game_executor_tx
            .send(GameToExecutorMessage::PlayerVirtuallyMoved(
                self.player_state.clone(),
            ))
            .unwrap();

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
        clear_background(color_u8!(211, 198, 232, 255));

        draw_texture_ex(
            self.background_texture,
            0.0,
            0.0,
            WHITE,
            DrawTextureParams {
                rotation: 0.0,
                ..Default::default()
            },
        );

        // draw title
        draw_text("Collect Massa Tokens", 800f32, 20f32, 20f32, WHITE);
        draw_text(
            "L/R - rotate, UP - move, SPACE - accelerate",
            0f32,
            450f32,
            20f32,
            WHITE,
        );

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

//#[tokio::main(worker_threads = 1)]
#[tokio::main]
async fn main() {
    // create a channel to communicate between blockchain (Events) --> game
    let (ch_blockchain_game_tx, ch_blockchain_game_rx) = channel::<PollResult>();

    // create a channel to communicate between main executor --> game
    let (ch_executor_game_tx, ch_executor_game_rx) = channel::<ExecutorToGameMessage>();

    // create a channel to communicate between game --> main executor
    let (ch_game_executor_tx, ch_game_executor_rx) = channel::<GameToExecutorMessage>();

    // create massa rpc client
    let massa_client = MassaClient::new_testnet().await;
    let massa_client = Arc::new(massa_client);
    let massa_polling_client = Arc::clone(&massa_client);
    let massa_sending_client = Arc::clone(&massa_client);

    ch_executor_game_tx
        .send(ExecutorToGameMessage::MassaConnected)
        .unwrap();

    // generate a thread - addresses map
    let map_thread_addresses = Arc::new(
        generate_thread_addresses_hashmap(&massa_sending_client.client)
            .await
            .unwrap(),
    );
    let map_thread_addresses_executor = Arc::clone(&map_thread_addresses);

    // check if player is registered
    let is_player_registered_res = massa_client
        .read_is_player_registered(&GAME_SC_ADDRESS, &PLAYER_ADDRESS)
        .await
        .unwrap();
    let is_player_registered = is_player_registered_res.output_events[0]
        .data
        .parse::<bool>()
        .ok()
        .unwrap_or_default();

    // register player
    /*
    let executor = hm_thread_addresses.get(&1).unwrap();
    match massa_client.call_register_player(
        &*GAME_SC_ADDRESS,
        &*PLAYER_ADDRESS,
        executor)
        .await {
        Ok(ids) => {
            println!("Player registered op id {:?}", ids);
        },
        Err(e) => {
            println!("Error registering player {:?}", e.to_string());
        }
    }
    */

    // TODO: await the tx status
 
    // TODO: get all currently connected players from 1) chain load_online_players() 2) load_tokens_state()

    // TODO: check if player is registered or not, evtl. register
    let initial_player_state = PlayerState {
        id: "uuid-1234".to_string(),
        address: *GAME_SC_ADDRESS,
        position: Vec2::new(0f32, 0f32),
        rotation: 90f32,
        cbox: 10.0f32,
        tokensCollected: 0,
    };
    let initial_collectible_states = Vec::new();
    ch_executor_game_tx
        .send(ExecutorToGameMessage::PlayerRegistered)
        .unwrap();

    // create events filter
    let event_extended_filter = ExtendedEventFilter {
        event_regex: Some(vec![
            GAME_TOKENS_STATE_UPDATED_EVENT_KEY.into(),
            PLAYER_MOVED_EVENT_KEY.into(),
            PLAYER_ADDED_EVENT_KEY.into(),
            PLAYER_REMOVED_EVENT_KEY.into(),
            TOKEN_COLLECTED_EVENT_KEY.into(),
        ]), // enum all events we are interested in collecting
        event_filter: EventFilter {
            start: None,
            end: None,
            emitter_address: Some(*GAME_SC_ADDRESS), // game address
            original_caller_address: None,
            original_operation_id: None,
            is_final: Some(true), // poll only final events
        },
    };

    // start polling massa sc for events in a separate tokio thread
    poll_contract_events(
        massa_polling_client,
        event_extended_filter,
        ch_blockchain_game_tx,
    )
    .await;
    ch_executor_game_tx
        .send(ExecutorToGameMessage::ServerStreamingStarted)
        .unwrap();

    // spawn a tokio thread receiving updates from within the game
    // TODO: kill the thread upon game exit
    tokio::spawn(async move {
        println!("game_executor_receiver started");
        loop {
            let msg = ch_game_executor_rx.try_recv().ok();
            if let Some(msg) = msg {
                match msg {
                    GameToExecutorMessage::PlayerVirtuallyMoved(player_pos) => {
                        //println!("PLAYER MOVED {:?}", msg);
                        let next_thread_to_exec_from =
                            get_thread_to_execute_from(&massa_sending_client.client)
                                .await
                                .unwrap();
                        let executor = map_thread_addresses_executor
                            .get(&next_thread_to_exec_from)
                            .unwrap();
                        /*
                        match massa_sending_client.call_set_player_pos(
                            &*GAME_SC_ADDRESS,
                            &*PLAYER_ADDRESS,
                            executor)
                            .await {
                            Ok(ids) => {
                                println!("Operation Id {:?}", ids);
                            },
                            Err(e) => {
                                println!("Error setting player position {:?}", e.to_string());
                            }
                        }
                        */
                    }
                    GameToExecutorMessage::Quit => {
                        println!("Player Quit");
                    }
                }
            }
        }
    });

    // spawn the game in a separate none-tokio thread
    // TODO: kill the thread upon game exit
    let game_single_thread_handle = thread::spawn(move || {
        Window::from_config(
            Conf {
                sample_count: 4,
                window_title: "Starship".to_string(),
                window_width: 1000,
                window_height: 500,
                fullscreen: false,
                high_dpi: true,
                ..Default::default()
            },
            run_game(
                initial_player_state,
                initial_collectible_states,
                ch_blockchain_game_rx,
                ch_executor_game_rx,
                ch_game_executor_tx,
            ),
        );
    });

    // join the game to main tokio thread
    ch_executor_game_tx
        .send(ExecutorToGameMessage::Started)
        .unwrap();

    game_single_thread_handle.join().unwrap();
}

async fn run_game(
    initial_player_state: PlayerState,
    initial_collectible_states: Vec<CollectibleToken>,
    ch_blockchain_game_rx: Receiver<PollResult>,
    ch_executor_game_rx: Receiver<ExecutorToGameMessage>,
    ch_game_executor_tx: Sender<GameToExecutorMessage>,
) {
    let mut game = Game::new(initial_player_state, initial_collectible_states).await;

    loop {
        // clone the game to executor tx sender
        let ch_game_executor_tx = ch_game_executor_tx.clone();

        // receive and process external game messages
        let game_status_msg = ch_executor_game_rx.try_recv().ok();
        if let Some(game_msg) = game_status_msg {
            match game_msg {
                ExecutorToGameMessage::MassaConnected => {
                    info!("Connected to Massa!")
                }
                ExecutorToGameMessage::ServerStreamingStarted => {
                    info!("Server streaming Started!")
                }
                ExecutorToGameMessage::PlayerRegistered => {
                    info!("Player Registered on Massa!")
                }
                ExecutorToGameMessage::Started => {
                    info!("Game Started!")
                }
                _ => {
                    info!("Unknown Message!")
                }
            }
        }

        // receive and process chain messages
        let chain_msg = ch_blockchain_game_rx.try_recv().ok();

        let onchain_updates = chain_msg.and_then(|poll_result| match poll_result {
            PollResult::Events(poll_result) => {
                let mut cummulative_updates: Vec<OnchainUpdateMessage> = vec![];

                // =================== collectible tokens update ===================
                let collectible_token_update = parse_collectible_events(&poll_result);
                if !collectible_token_update.is_empty() {
                    cummulative_updates.push(OnchainUpdateMessage::CollectiblesNewState(
                        collectible_token_update,
                    ));
                }
                // =================== players moved ===================
                let players_moved_update = parse_players_movement_events(&poll_result);
                if !players_moved_update.is_empty() {
                    cummulative_updates.push(OnchainUpdateMessage::PlayerMovedOnchain(
                        players_moved_update,
                    ));
                }
                // =================== players added ===================
                let players_added_update = parse_added_players_events(&poll_result);
                if !players_added_update.is_empty() {
                    cummulative_updates.push(OnchainUpdateMessage::PlayerAddedOnchain(
                        players_added_update,
                    ));
                }
                // =================== players removed ===================
                let players_removed_update = parse_removed_players_events(&poll_result);

                if !players_removed_update.is_empty() {
                    cummulative_updates.push(OnchainUpdateMessage::PlayerRemovedOnchain(
                        players_removed_update,
                    ));
                }

                Some(cummulative_updates)
            }
            PollResult::Error(e) => {
                info!("Received error ? {:?}", e);
                None
            }
        });

        game.update(onchain_updates, ch_game_executor_tx);
        game.draw();
        if game.quit {
            return;
        }
        next_frame().await;
    }
}
