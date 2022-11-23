/* eslint-disable max-len */
import {collections} from '@massalabs/massa-as-sdk/assembly';
import {
  GENERATED_TOKENS_MAP_KEY,
  LASER_STATES_MAP_KEY,
  REGISTERED_PLAYERS_EXECUTORS_MAP_KEY,
  REGISTERED_PLAYERS_LASERS_MAP_KEY,
  REGISTERED_PLAYERS_MAP_KEY,
  REGISTERED_PLAYERS_STATES_MAP_KEY,
  REGISTERED_PLAYERS_TOKEN_COUNTS_MAP_KEY,
  REGISTERED_PLAYERS_TOKEN_UUIDS_MAP_KEY,
  SPAWNED_LASER_INTERPOLATIONS_KEY,
} from './config';

// registered players map [player_address - bool]
export const registeredPlayers = new collections.PersistentMap<string, boolean>(
    REGISTERED_PLAYERS_MAP_KEY
);

// registered players states map [player_address - player entity (serialized)]
export const playerStates = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_STATES_MAP_KEY
);

// player lasers states map [player_address - player laser uuids (serialized) "uuid1,uuid2,..."]
export const playerLaserUuids = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_LASERS_MAP_KEY
);

// player lasers states map [laser uuid - interpolated laser state (serialized)]
export const laserStates = new collections.PersistentMap<string, string>(
    LASER_STATES_MAP_KEY
);

// player lasers states map [laser uuid - bool]
export const spawnedLaserInterpolators = new collections.PersistentMap<string, string>(
    SPAWNED_LASER_INTERPOLATIONS_KEY
);

// registered players tokens map [player_address - token count (number)]
export const playerTokensCount = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_TOKEN_COUNTS_MAP_KEY
);

// registered players tokens uuids map [player_address - player token uuids (serialized) "uuid1,uuid2,..."]
export const playerTokensUuids = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_TOKEN_UUIDS_MAP_KEY
);

// registered players executor secret keys map [player_address - secret keys (serialized) "sk1,sk2,..."]
export const playerExecutors = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_EXECUTORS_MAP_KEY
);

// generated tokens map [token_index - token data (serialized)]
export const generatedTokens = new collections.PersistentMap<u16, string>(
    GENERATED_TOKENS_MAP_KEY
);
