use std::str::FromStr;

use massa_models::{address::Address, output_event::SCOutputEvent};

use crate::{
    entities::{CollectibleToken, GameEvent, PlayerEntityOnchain},
    GAME_TOKENS_STATE_UPDATED_EVENT_KEY, PLAYER_ADDED_EVENT_KEY, PLAYER_MOVED_EVENT_KEY,
    PLAYER_REMOVED_EVENT_KEY,
};

pub fn parse_collectible_events(poll_result: &Vec<SCOutputEvent>) -> Vec<CollectibleToken> {
    // =================== collectible tokens update ===================
    let collectible_token_update = poll_result
        .iter()
        .filter_map(|event| {
            if event.data.contains(GAME_TOKENS_STATE_UPDATED_EVENT_KEY) {
                let event_parts: Vec<&str> = event.data.split("=").collect();
                let event_data = event_parts[1].to_owned();
                let event_parts: Vec<&str> = event_data.split("@").collect();

                let tokens = event_parts
                    .iter()
                    .map(|&e| {
                        let token = serde_json::from_slice::<CollectibleToken>(e.as_bytes());
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

    collectible_token_update
}

pub fn parse_players_movement_events(poll_result: &Vec<SCOutputEvent>) -> Vec<PlayerEntityOnchain> {
    let players_moved_update = poll_result
        .iter()
        .filter_map(|event| {
            if event.data.contains(PLAYER_MOVED_EVENT_KEY) {
                let players_moved_update =
                    serde_json::from_slice::<GameEvent>(event.data.as_bytes())
                        .ok()
                        .map(|game_event| {
                            let event_parts: Vec<&str> = game_event.data.split("=").collect();
                            let event_serialized_data = event_parts[1].to_owned();

                            let players_moved_update =
                                serde_json::from_slice::<PlayerEntityOnchain>(
                                    event_serialized_data.as_bytes(),
                                )
                                .ok();

                            players_moved_update
                        })
                        .flatten();

                return players_moved_update;
            }
            None
        })
        .collect::<Vec<PlayerEntityOnchain>>();

    players_moved_update
}

pub fn parse_added_players_events(poll_result: &Vec<SCOutputEvent>) -> Vec<PlayerEntityOnchain> {
    let players_added_update = poll_result
        .iter()
        .filter_map(|event| {
            if event.data.contains(PLAYER_ADDED_EVENT_KEY) {
                let players_added_update =
                    serde_json::from_slice::<GameEvent>(event.data.as_bytes())
                        .ok()
                        .map(|game_event| {
                            let event_parts: Vec<&str> = game_event.data.split("=").collect();
                            let event_serialized_data = event_parts[1].to_owned();

                            let players_added_update =
                                serde_json::from_slice::<PlayerEntityOnchain>(
                                    event_serialized_data.as_bytes(),
                                )
                                .ok();

                            players_added_update
                        })
                        .flatten();

                return players_added_update;
            }
            None
        })
        .collect::<Vec<PlayerEntityOnchain>>();

    players_added_update
}

pub fn parse_removed_players_events(poll_result: &Vec<SCOutputEvent>) -> Vec<Address> {
    let players_removed_update = poll_result
        .iter()
        .filter_map(|event| {
            if event.data.contains(PLAYER_REMOVED_EVENT_KEY) {
                let player_removed = serde_json::from_slice::<GameEvent>(event.data.as_bytes())
                    .ok()
                    .map(|game_event| {
                        let event_parts: Vec<&str> = game_event.data.split("=").collect();
                        let event_serialized_data = event_parts[1].to_owned();

                        let player_removed =
                            serde_json::from_slice::<String>(event_serialized_data.as_bytes())
                                .ok()
                                .map(|s| Address::from_str(s.as_str()).ok())
                                .flatten();

                        player_removed
                    })
                    .flatten();

                return player_removed;
            }
            None
        })
        .collect::<Vec<Address>>();

    players_removed_update
}
