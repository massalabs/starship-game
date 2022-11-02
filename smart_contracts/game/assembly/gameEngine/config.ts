/* eslint-disable max-len */
import {Amount} from '@massalabs/as/assembly';

// ------------------------- storage keys -------------------------
export const REGISTERED_PLAYERS_MAP_KEY = 'registered_players_map_key';
export const REGISTERED_PLAYERS_STATES_MAP_KEY = 'registered_players_states_key';
export const REGISTERED_PLAYERS_TOKEN_COUNTS_MAP_KEY = 'registered_players_token_counts_key';
export const REGISTERED_PLAYERS_TOKEN_UUIDS_MAP_KEY = 'registered_players_token_uuids_key';
export const GENERATED_TOKENS_MAP_KEY = 'generated_tokens_key';
export const OWNER_ADDRESS_KEY = 'owner_key';
export const LAST_SLOT_INDEX_KEY = 'last_slot_index_key';
export const TOKEN_ADDRESS_KEY = 'token_address_key';
export const GENERATED_TOKENS_COUNT_KEY = 'state_key';
export const SCREEN_WIDTH_KEY = 'screen_width_key';
export const SCREEN_HEIGHT_KEY = 'screen_height_key';
export const MAX_PLAYERS_KEY = 'max_players_key';
export const ACTIVE_PLAYERS_KEY = 'active_players_key';
export const ACTIVE_PLAYERS_ADDRESSES_KEY = 'active_players_addresses_key';

// ------------------------- events -------------------------

// game owner
export const TOKEN_ADDRESS_ADDED = 'TOKEN_ADDRESS_ADDED';
export const GAME_OWNER_ADDRESS_ADDED = 'GAME_OWNER_ADDRESS_ADDED';

// player
export const PLAYER_ADDED = 'PLAYER_ADDED';
export const PLAYER_REMOVED = 'PLAYER_REMOVED';
export const PLAYER_MOVED = 'PLAYER_MOVED';

// tokens
export const TOKEN_ADDED = 'TOKEN_ADDED';
export const TOKEN_REMOVED = 'TOKEN_REMOVED';
export const TOKEN_COLLECTED = 'TOKEN_COLLECTED';

// screen
export const SCREEN_WIDTH_ADJUSTED = 'SCREEN_WIDTH_ADJUSTED';
export const SCREEN_HEIGHT_ADJUSTED = 'SCREEN_HEIGHT_ADJUSTED';

// ------------------------- global settings -------------------------
export const THREADS: u8 = 32;
export const TOTAL_ONSCREEN_TOKENS: u16 = 10;
export const COLLECTIBLE_BOUNDING_BOX: f32 = 50.0;
export const PLAYER_BOUNDING_BOX: f32 = 64.0;
export const COLLECTIBLE_VALUE: Amount = new Amount(1);
