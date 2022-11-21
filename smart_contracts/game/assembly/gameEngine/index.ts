/* eslint-disable max-len */
/* Smart Contract Implementation of the Starship Multiplayer Game Server
 *
 * */
import {
  Storage,
  Address,
  Context,
  currentPeriod,
  currentThread,
  generateEvent,
  sendMessage,
  token,
  collections,
  env,
} from '@massalabs/massa-as-sdk/assembly';
import {Amount, Currency} from '@massalabs/as/assembly';
import {Rectangle, _isIntersection} from './utils/rectangle';
import {PlayerEntity} from './entities/playerEntity';
import {CollectibleEntity} from './entities/collectibleEntity';
import {CollectedEntityEvent} from './events/collectedEntityEvent';
import {_formatGameEvent, _generateAsyncEvent, _sendGameEvent} from './events/eventEmitter';
import {RegisterPlayerRequest} from './requests/RegisterPlayerRequest';
import {PlayerTokenCollected} from './playerTokenCollected';
import {_generateUuid, _randomCoordInRange, _randomUintInRange} from './utils/random';
import {ACTIVE_PLAYERS_ADDRESSES_KEY,
  ACTIVE_PLAYERS_KEY,
  COLLECTIBLE_BOUNDING_BOX,
  COLLECTIBLE_VALUE,
  GAME_OWNER_ADDRESS_ADDED,
  GENERATED_TOKENS_COUNT_KEY,
  GENERATED_TOKENS_MAP_KEY,
  LASER_STATES_MAP_KEY,
  LAST_SLOT_INDEX_KEY,
  MAX_PLAYERS_KEY,
  OWNER_ADDRESS_KEY,
  PLAYER_ADDED,
  PLAYER_BOUNDING_BOX,
  PLAYER_REMOVED,
  REGISTERED_PLAYERS_EXECUTORS_MAP_KEY,
  REGISTERED_PLAYERS_LASERS_MAP_KEY,
  REGISTERED_PLAYERS_MAP_KEY,
  REGISTERED_PLAYERS_STATES_MAP_KEY,
  REGISTERED_PLAYERS_TOKEN_COUNTS_MAP_KEY,
  REGISTERED_PLAYERS_TOKEN_UUIDS_MAP_KEY,
  SCREEN_HEIGHT_ADJUSTED,
  SCREEN_HEIGHT_KEY,
  SCREEN_WIDTH_ADJUSTED,
  SCREEN_WIDTH_KEY,
  SPAWNED_LASER_INTERPOLATIONS_KEY,
  THREADS,
  TOKEN_ADDED,
  TOKEN_ADDRESS_ADDED,
  TOKEN_ADDRESS_KEY,
  TOKEN_COLLECTED,
  TOKEN_REMOVED,
  TOTAL_ONSCREEN_TOKENS} from './config';
import {SetPlayerLaserRequest} from './requests/SetPlayerLaserRequest';

export {_generateAsyncEvent, _sendGameEvent} from './events/eventEmitter';

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
export const spawnedLaserInterpolators = new collections.PersistentMap<string, bool>(
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

/**
 * Returns if the Player Address has been registered or not.
 * @param {Address} address - Address of the player.
 * @return {bool} indicates if player is registered or not.
 */
function _isPlayerRegistered(address: Address): bool {
  return registeredPlayers.contains(address.toByteString());
}

/**
 * Returns if the an Address is a game owner or not. Returns true if no game ower is yet set
 * @param {Address} caller - Caller to be compared with the game owner in storage.
 * @return {bool}
 */
function _assertGameOwner(caller: Address): bool {
  if (!Storage.has(OWNER_ADDRESS_KEY)) {
    return true; // no game owner set yet
  }
  // else - game owner is set, check if it equals the caller
  const gameOwner = Address.fromByteString(Storage.get(OWNER_ADDRESS_KEY));
  if (gameOwner.equals(caller)) {
    return true;
  }

  // game owner is not the caller
  return false;
}

/**
 * Returns if the an Address is a game owner or not. Returns true if no game ower is yet set
 * @return {bool}
 */
function _checkMaxPlayersLimit(): bool {
  if (!Storage.has(MAX_PLAYERS_KEY)) {
    return true; // no need to check max players count
  }
  const maxPlayersCount = parseInt(Storage.get(MAX_PLAYERS_KEY), 10);
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  if (currentPlayersCount + 1 > maxPlayersCount) {
    return false; // violated
  }
  return true; // ok - not violated
}

/**
 * Returns if the Player Address has been registered or not.
 * @param {string} address - Address of the player.
 * @return {string} the stringified boolean
 */
export function isPlayerRegistered(address: string): string {
  // read player address
  const addr = Address.fromByteString(address);
  const res = _isPlayerRegistered(addr);
  generateEvent(`${res.toString()}`);
  return res.toString();
}

/**
 * Returns if the Player Address has been registered or not.
 * @param {string} address - Address of the player.
 * @return {string} the player uuid
 */
export function getRegisteredPlayerUuid(address: string): string {
  // read player address
  const addr = Address.fromByteString(address);
  // assert player is registered
  assert(
      _isPlayerRegistered(addr),
      `Player address ${addr.toByteString()} has not been registered`
  );
  // get the player entity from storage
  const player = <string>playerStates.get(addr.toByteString());
  const playerEntity = PlayerEntity.parseFromString(player);
  // return the entity uuid
  generateEvent(`${playerEntity.uuid}`);
  return playerEntity.uuid;
}

/**
 * Returns if the Player Address has been registered or not.
 * @param {string} _args - Address of the player.
 * @return {string} the player uuid
 */
export function getActivePlayersCount(_args: string): string {
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  // return the entity uuid
  generateEvent(`${currentPlayersCount}.toString()`);
  return currentPlayersCount.toString();
}

/**
 * Returns if the Player Address has been registered or not.
 * @param {string} _args - Address of the player.
 * @return {string} the player uuid
 */
export function getMaximumPlayersCount(_args: string): string {
  const maximumPlayersCount = parseInt(Storage.get(MAX_PLAYERS_KEY), 10);
  // return the entity uuid
  generateEvent(`${maximumPlayersCount}.toString()`);
  return maximumPlayersCount.toString();
}

/**
 * Sets the screen width
 * @param {string} screenWidth - Screen width to set.
 */
export function setScreenWidth(screenWidth: string): void {
  // check that the caller is the game owner
  assert(Context.caller().isValid(), 'Caller in setScreenWidth must be valid');
  assert(_assertGameOwner(Context.caller()));
  Storage.set(SCREEN_WIDTH_KEY, screenWidth);

  // send async vent to all players
  _generateAsyncEvent(_formatGameEvent(SCREEN_WIDTH_ADJUSTED, screenWidth));
}

/**
 * Sets the screen width
 * @param {string} screenHeight - Screen width to set.
 */
export function setScreenHeight(screenHeight: string): void {
  // check that the caller is the game owner
  assert(Context.caller().isValid(), 'Caller in setScreenHeight must be valid');
  assert(_assertGameOwner(Context.caller()));
  Storage.set(SCREEN_HEIGHT_KEY, screenHeight);

  // send async event to all players
  _generateAsyncEvent(_formatGameEvent(SCREEN_HEIGHT_ADJUSTED, screenHeight));
}

/**
 * Sets the token address
 * @param {string} tokenAddress - Address of the token.
 */
export function addTokenAddress(tokenAddress: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(TOKEN_ADDRESS_KEY, tokenAddress.toString());

  // send async event to all players
  _generateAsyncEvent(_formatGameEvent(TOKEN_ADDRESS_ADDED, tokenAddress.toString()));
}

/**
 * Returns the token address
 * @param {string} _args - ?
 * @return {string}
 */
export function getTokenAddress(_args: string): string {
  assert(Storage.has(TOKEN_ADDRESS_KEY), 'Token Address not set');
  const res = Storage.get(TOKEN_ADDRESS_KEY);
  generateEvent(`${res}`);
  return res;
}

/**
 * Sets the game owner address
 * @param {string} _args - ?
 */
export function addGameOwnerAddress(_args: string): void {
  // check that the caller is the game owner.
  // For initial calls, there is no owner and the check will pass
  assert(_assertGameOwner(Context.caller()));
  Storage.set(OWNER_ADDRESS_KEY, Context.caller().toByteString());

  // send async event to all players
  _generateAsyncEvent(_formatGameEvent(GAME_OWNER_ADDRESS_ADDED, Context.caller().toByteString()));
}

/**
 * Returns the game owner address
 * @param {string} _args - ?
 * @return {string} string The game owner address
 */
export function getGameOwnerAddress(_args: string): string {
  assert(Storage.has(OWNER_ADDRESS_KEY), 'Game Owner Address not set');
  const res = Storage.get(OWNER_ADDRESS_KEY);
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the game owner address
 * @param {string} _args - ?
 * @return {string} string The game owner address
 */
export function getActivePlayersAddresses(_args: string): string {
  assert(Storage.has(ACTIVE_PLAYERS_ADDRESSES_KEY), 'No active players addresses');
  const activePlayersAddresses = Storage.get(ACTIVE_PLAYERS_ADDRESSES_KEY);
  generateEvent(`${activePlayersAddresses}`);
  return activePlayersAddresses;
}

/**
 * Register a new player.
 *
 * @param {string} args - Address of the player.
 */
export function registerPlayer(args: string): void {
  // parse player register request
  const playerRegisterRequest = RegisterPlayerRequest.parseFromString(args);

  // read player address
  const addr = Address.fromByteString(playerRegisterRequest.address);

  // TODO: gameOwner to register player ????
  // TODO: player must also register its thread addresses that he uses to send a message too ?

  // check the player has not been already registered
  if (_isPlayerRegistered(addr)) {
    return;
  }

  // check max player count is not exceeded
  if (!_checkMaxPlayersLimit()) {
    return;
  }

  // mark player as registered
  registeredPlayers.set(addr.toByteString(), true);

  // get screen width/height
  const screenHeight = Storage.get(SCREEN_HEIGHT_KEY);
  const screenHeightF32: f64 = parseFloat(screenHeight);

  // set storage
  const playerEntity: PlayerEntity = {
    uuid: _generateUuid(),
    address: addr.toByteString(),
    name: playerRegisterRequest.name,
    x: 0.0,
    y: screenHeightF32/2.0 as f32,
    rot: -1.0,
    w: 0.0,
    cbox: PLAYER_BOUNDING_BOX,
  } as PlayerEntity;
  const serializedPlayerData: string = playerEntity.serializeToString();
  playerStates.set(addr.toByteString(), serializedPlayerData);

  // increase active players count
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  Storage.set(ACTIVE_PLAYERS_KEY, (currentPlayersCount + 1).toString());

  // save player's executors
  playerExecutors.set(addr.toByteString(), playerRegisterRequest.executors);

  // add player address to the list of active players (separated by comma)
  let updatedPlayersAddresses = '';
  if (Storage.has(ACTIVE_PLAYERS_ADDRESSES_KEY)) {
    const activePlayersAddresses = Storage.get(ACTIVE_PLAYERS_ADDRESSES_KEY);
    updatedPlayersAddresses = `${activePlayersAddresses},${addr.toByteString()}`;
  } else {
    updatedPlayersAddresses = addr.toByteString();
  }
  Storage.set(ACTIVE_PLAYERS_ADDRESSES_KEY, updatedPlayersAddresses);

  // generate a message
  const eventMessage = _formatGameEvent(PLAYER_ADDED, serializedPlayerData);

  // send event from caller as a function return value
  generateEvent(eventMessage);

  // send async event from sc to all players
  _generateAsyncEvent(eventMessage);
}

/**
 * Delete player.
 *
 * @param {string} address - Address of the player.
 */
export function removePlayer(address: string): void {
  // read player address
  const addr = Address.fromByteString(address);

  // TODO: gameOwner to register player ????
  // TODO: player must also register its thread addresses that he uses to send a message too ?

  // check the player has not been already registered
  assert(_isPlayerRegistered(addr));

  // get player data
  const playerState = playerStates.get(addr.toByteString());
  const playerEntity = PlayerEntity.parseFromString(playerState as string);

  // mark player as registered and delete all of its tokens and states
  registeredPlayers.delete(addr.toByteString());
  playerExecutors.delete(addr.toByteString());
  playerStates.delete(addr.toByteString());
  if (playerTokensCount.get(addr.toByteString())) {
    playerTokensCount.delete(addr.toByteString());
  }

  // decrease active players count
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  const newCount = currentPlayersCount - 1;
  Storage.set(ACTIVE_PLAYERS_KEY, newCount < 0 ? '0'.toString() : newCount.toString());

  // remove player from the list of active players (separated by comma)
  let updatedPlayersAddresses = '';
  if (Storage.has(ACTIVE_PLAYERS_ADDRESSES_KEY)) {
    const activePlayersAddresses = Storage.get(ACTIVE_PLAYERS_ADDRESSES_KEY).split(',');
    const reducedAddresses: Array<string> = [];
    for (let i = 0; i < activePlayersAddresses.length; i ++) {
      if (activePlayersAddresses[i] !== addr.toByteString()) {
        reducedAddresses.push(activePlayersAddresses[i]);
      }
    }
    updatedPlayersAddresses = `${reducedAddresses.join(',')}`;
  }
  Storage.set(ACTIVE_PLAYERS_ADDRESSES_KEY, updatedPlayersAddresses);

  // generate a message
  const eventMessage = _formatGameEvent(PLAYER_REMOVED, playerEntity.serializeToString());

  // send event from caller as a func return value
  generateEvent(eventMessage);

  // send async event to all players
  _generateAsyncEvent(eventMessage);
}

/**
 * Moves the player by setting absolute coordinates.
 *
 * @param {string} _args - stringified PlayArgs.
 */
export function setPlayerAbsCoors(_args: string): void {
  // read player abs coords
  const playerEntityUpdate = PlayerEntity.parseFromString(_args);
  // check that player is already registered
  assert(
      _isPlayerRegistered(new Address(playerEntityUpdate.address)),
      'Player has not been registered'
  );

  // TODO: verify that is one of the player signing addresses (thread addresses) and the update is for the player address + uuid
  // also verify coords ????

  // update storage
  const serializedPlayerData: string = playerEntityUpdate.serializeToString();
  playerStates.set(
      playerEntityUpdate.address,
      serializedPlayerData
  );

  // check if player has collected a token based on his pos
  const intersectionState: PlayerTokenCollected = {
    playerState: serializedPlayerData,
    tokensState: serializeCollectiblesState(),
  } as PlayerTokenCollected;

  // once moved, run an async function to check for player-token collisions
  _checkTokensCollectedAsync(intersectionState.serializeToString());

  // TODO: _checkLaserCollisionsAsync???

  // send event
  // _generateEvent(_formatGameEvent(PLAYER_MOVED, serializedPlayerData));
}

/**
 * Sets the player's lasers data at a given time T
 *
 * @param {string} _args - stringified PlayArgs.
 */
export function setLaserPos(_args: string): void {
  // read player laser update
  const playerLaserUpdate = SetPlayerLaserRequest.parseFromString(_args);
  // check that player is already registered
  assert(
      _isPlayerRegistered(new Address(playerLaserUpdate.playerAddress)),
      'Player has not been registered'
  );

  // TODO: verify that is one of the player signing addresses (thread addresses) and the update is for the player address + uuid
  // also verify coords ????

  // update the player uuids
  let playerActiveLasersSerialized = playerLaserUuids.get(playerLaserUpdate.playerAddress);
  if (playerActiveLasersSerialized) {
    const currentActiveLaserUuids = playerActiveLasersSerialized.split(',');
    for (let uuidIndex: i32 = 0; uuidIndex < currentActiveLaserUuids.length; uuidIndex++) {
      let alreadyExists = false;
      if (playerLaserUpdate.uuid === currentActiveLaserUuids[uuidIndex]) {
        alreadyExists = true;
      }
      if (!alreadyExists) {
        playerActiveLasersSerialized = `${playerActiveLasersSerialized},${playerLaserUpdate.uuid}`;
      }
    }
  } else {
    playerActiveLasersSerialized = `${playerLaserUpdate.uuid}`;
  }
  playerTokensUuids.set(playerLaserUpdate.playerAddress, playerActiveLasersSerialized);

  // add the laser uuid to the laser states map if needed
  if (!laserStates.contains(playerLaserUpdate.uuid)) {
    laserStates.set(playerLaserUpdate.uuid, playerLaserUpdate.serializeToString());
  }

  // check for spawned async interpolator, if not, spawn one and mark it
  if (!spawnedLaserInterpolators.contains(playerLaserUpdate.uuid) || !spawnedLaserInterpolators.get(playerLaserUpdate.uuid)) {
    spawnedLaserInterpolators.set(playerLaserUpdate.uuid, true);

    // run an async function to:
    // 1. interpolate the laser movement
    // 2. check for out-of-bound lasers and update state
    _interpolateLaserMovementAsync(playerLaserUpdate.uuid);
  }
}

/**
 * Returns the player position.
 *
 * @param {string} address - Address of the player.
 * @return {string} - the player position.
 */
export function getPlayerPos(address: string): string {
  // get player address
  const playerAddress = Address.fromByteString(address);
  // check that player is already registered
  assert(_isPlayerRegistered(playerAddress), 'Player has not been registered');
  const res = <string>playerStates.get(playerAddress.toByteString());
  // generate a normal event as a func return value
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the player lasers uuids.
 *
 * @param {string} address - Address of the player.
 * @return {string} - the player lasers uuids (stringified as "uuid1,uuid2,uuid3,....").
 */
export function getPlayerLasersUuids(address: string): string {
  // get player address
  const playerAddress = Address.fromByteString(address);
  // check that player is already registered
  assert(_isPlayerRegistered(playerAddress), 'Player has not been registered');
  const res = <string>playerLaserUuids.get(playerAddress.toByteString());
  // generate a normal event as a func return value
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the player executors.
 *
 * @param {string} address - Address of the player.
 * @return {string} - the player executors as a string sep by commas.
 */
export function getPlayerExecutors(address: string): string {
  // get player address
  const playerAddress = Address.fromByteString(address);
  // check that player is already registered
  assert(_isPlayerRegistered(playerAddress), 'Player has not been registered');
  const res = <string>playerExecutors.get(playerAddress.toByteString());
  // generate a normal event as a func return value
  generateEvent(`${res}`);
  return res;
}

/**
 * Player collects a token.
 *
 * @param {string} address - Address of the player.
 * @return {string} - the player balance (stringified).
 */
export function getPlayerTokens(address: string): string {
  // read player address
  const playerAddress = Address.fromByteString(address);
  // check that player is already registered
  assert(_isPlayerRegistered(playerAddress), 'Player has not been registered');
  // get player tokens from collections
  const tokens = playerTokensCount.get(playerAddress.toByteString());
  const tokensCount = tokens ? parseFloat(tokens) : 0.0;
  // generate a normal event as a func return value
  generateEvent(`${tokensCount.toString()}`);
  return tokensCount.toString();
}

/**
 * Player collects a token.
 *
 * @param {string} address - Address of the player.
 * @return {string} - the player balance (stringified).
 */
export function getPlayerBalance(address: string): string {
  // read player address
  const playerAddress = Address.fromByteString(address);
  // check that player is already registered
  assert(_isPlayerRegistered(playerAddress), 'Player has not been registered');
  // assert token address is set
  assert(Storage.has(TOKEN_ADDRESS_KEY), 'Token address not set');
  // read token address
  const tokenAddress = Address.fromByteString(Storage.get(TOKEN_ADDRESS_KEY));

  // get massa coin impl wrapper
  const collToken = new token.TokenWrapper(tokenAddress);
  // get player balance
  const res = collToken.balanceOf(playerAddress).value().toString();
  // generate a normal event as a func return value
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the massa tokens state.
 * @param {string} _args - ?
 * @return {string} - the stringified massa tokens state.
 */
export function getCollectiblesState(_args: string): string {
  const res = serializeCollectiblesState();
  // generate a normal event as a func return value
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the massa tokens state.
 * @return {string} - the stringified massa tokens state.
 */
function serializeCollectiblesState(): string {
  const generatedRandomTokens: Array<string> = [];
  for (let tokenIndex: u16 = 0; tokenIndex < TOTAL_ONSCREEN_TOKENS; tokenIndex++) {
    const randomCollectibleEntity = generatedTokens.get(tokenIndex);
    generatedRandomTokens.push(randomCollectibleEntity as string);
  }
  const res = generatedRandomTokens.join('@');
  return res;
}

/**
 * Returns the massa tokens state.
 * @param {string} args - ?
 * @return {collections.PersistentMap<u16, string>} - the stringified massa tokens state.
 */
function deserializeCollectiblesState(args: string): collections.PersistentMap<u16, string> {
  const map: collections.PersistentMap<u16, string> = new collections.PersistentMap<u16, string>(_generateUuid());
  const serializedTokensState = args.split('@');

  for (let tokenIndex: u16 = 0; tokenIndex < <u16>serializedTokensState.length; tokenIndex++) {
    map.set(tokenIndex, serializedTokensState[tokenIndex]);
  }
  return map;
}

/**
 * Returns the massa tokens state.
 * @param {collections.PersistentMap<u16, string>} map - the stringified massa tokens state.
 */
function cleanCollectiblesState(map: collections.PersistentMap<u16, string>): void {
  for (let tokenIndex: u16 = 0; tokenIndex < map.size(); tokenIndex++) {
    map.delete(tokenIndex);
  }
}

/**
 * Check if a player has collected a token.
 *
 * @param {Entity} args - Position of the player.
 */
export function _checkTokensCollected(args: string): void {
  // check that the caller is the contract itself
  assert(Context.callee().isValid(), 'Callee in _checkTokensCollected must be valid');
  assert(Context.caller().isValid(), 'Caller in _checkTokensCollected must be valid');
  assert(Context.callee().equals(Context.caller()));

  const playerTokensState = PlayerTokenCollected.parseFromString(args);
  const serializedPlayerState = playerTokensState.playerState;
  const serializedTokensState = playerTokensState.tokensState;

  // retrieve the player entity
  const playerPos = PlayerEntity.parseFromString(serializedPlayerState);

  // retrieve the tokens state by deserializing (only temp)
  const tokensStateAtState: collections.PersistentMap<u16, string> = deserializeCollectiblesState(serializedTokensState);

  const playerCboxFrame: f32 = playerPos.cbox/2.0;

  // evaluate the player bounding box
  const playerCbox = new Rectangle(
      playerPos.x - playerCboxFrame,
      playerPos.x + playerCboxFrame,
      playerPos.y + playerCboxFrame,
      playerPos.y - playerCboxFrame
  );

  // loop over all tokens and find intersections
  for (let i: u16 = 0; i < tokensStateAtState.size(); i++) {
    const collectibleEntity = CollectibleEntity.parseFromString(
        <string>tokensStateAtState.get(i)
    );
    const collectibleCboxFrame: f32 = collectibleEntity.cbox/2.0;
    const collectibleCbox = new Rectangle(
        collectibleEntity.x - collectibleCboxFrame,
        collectibleEntity.x + collectibleCboxFrame,
        collectibleEntity.y + collectibleCboxFrame,
        collectibleEntity.y - collectibleCboxFrame
    );

    if (_isIntersection(collectibleCbox, playerCbox)) {
      // check if the collectible has already been collected
      let isAlreadyCollected = false;
      let playerCollectedTokenUuids = playerTokensUuids.get(playerPos.address);
      if (playerCollectedTokenUuids) {
        const collectedUuids = playerCollectedTokenUuids.split(',');
        for (let uuidIndex: i32 = 0; uuidIndex < collectedUuids.length; uuidIndex++) {
          if (collectibleEntity.uuid === collectedUuids[uuidIndex]) {
            isAlreadyCollected = true;
          }
        }
        if (!isAlreadyCollected) {
          playerCollectedTokenUuids = `${playerCollectedTokenUuids},${collectibleEntity.uuid}`;
        }
      } else {
        playerCollectedTokenUuids = `${collectibleEntity.uuid}`;
      }
      playerTokensUuids.set(playerPos.address, playerCollectedTokenUuids);

      // if already collected, return
      if (isAlreadyCollected) {
        return;
      }

      // transfer the token to the player
      _playerCollectibleClaim(
          new Address(playerPos.address),
          <u64>collectibleEntity.value
      );

      // increase player collected tokens count
      const playerTokensCountStr = playerTokensCount.get(
          playerPos.address
      );
      const playerTokensCountIncreased = (playerTokensCountStr ? parseFloat(playerTokensCountStr) : 0.0) + 1.0;
      playerTokensCount.set(playerPos.address, playerTokensCountIncreased.toString());

      // append currently collected token to state
      const collectedEntity: CollectedEntityEvent = {
        uuid: collectibleEntity.uuid,
        playerUuid: playerPos.uuid,
        value: collectibleEntity.value,
        time: env.env.time() as f64,
      } as CollectedEntityEvent;

      // generate an event and send to all players
      _sendGameEvent(_formatGameEvent(TOKEN_COLLECTED, collectedEntity.serializeToString()));
    }
  }

  // deallocate the tokensState hashmap
  cleanCollectiblesState(tokensStateAtState);
}

/**
 * Interpolates a given laser movement
 *
 * @param {Entity} args - Tha laser uuid
 */
export function _interpolateLaserMovement(args: string): void {
  // check that the caller is the contract itself
  assert(Context.callee().isValid(), 'Callee in _checkTokensCollected must be valid');
  assert(Context.caller().isValid(), 'Caller in _checkTokensCollected must be valid');
  assert(Context.callee().equals(Context.caller()));

  // TODO: finish!
}

/**
 * Player collects a token.
 *
 * @param {Address} playerAddress - Address of the player.
 * @param {Address} collectibleValue - Value of the collectible.
 */
function _playerCollectibleClaim(
    playerAddress: Address,
    collectibleValue: u64
): void {
  // get token address
  const tokenAddress = Address.fromByteString(Storage.get(TOKEN_ADDRESS_KEY));

  // get collectible impl wrapper
  const collToken = new token.TokenWrapper(tokenAddress);

  // amount to send
  const amountToSend = new Amount(collectibleValue, new Currency(collToken.name(), 2, true)); // TODO: use decimals here!

  // token transfers X amount to player
  collToken.transfer(playerAddress, amountToSend);
}

/**
 * Stop creating collectibles.
 *
 * @param {string} _args - ?.
 */
export function stopCreatingCollectibles(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(LAST_SLOT_INDEX_KEY, '2000000000');
}

/**
 * Start creating collectibles.
 *
 * @param {string} _args - ?.
 */
export function initLastSlotIndex(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(LAST_SLOT_INDEX_KEY, '0');
}

/**
 * Initiates the token state, i.e. first generation round
 *
 * @param {string} _args - ?.
 */
export function initGeneratedGameTokens(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));

  // init tokens count
  if (!Storage.has(GENERATED_TOKENS_COUNT_KEY)) {
    Storage.set(GENERATED_TOKENS_COUNT_KEY, '0');
  }

  // get screen width/height
  const screenWidth = Storage.get(SCREEN_WIDTH_KEY);
  const screenWidthF32: f64 = parseFloat(screenWidth);

  const screenHeight = Storage.get(SCREEN_HEIGHT_KEY);
  const screenHeightF32: f64 = parseFloat(screenHeight);

  // generate initial tokens
  for (let tokenIndex: u16 = 0; tokenIndex < TOTAL_ONSCREEN_TOKENS; tokenIndex++) {
    const randomCollectibleEntity: CollectibleEntity = _generateRandomCollectible(screenWidthF32, screenHeightF32);
    generatedTokens.set(tokenIndex, randomCollectibleEntity.serializeToString());
  }
  Storage.set(GENERATED_TOKENS_COUNT_KEY, TOTAL_ONSCREEN_TOKENS.toString());
}

/**
 * Sets max players count.
 *
 * @param {string} _args - ?.
 */
export function setMaxPlayers(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));

  const maxPlayersCount = parseInt(_args, 10);

  // init players count
  if (!Storage.has(MAX_PLAYERS_KEY)) {
    Storage.set(MAX_PLAYERS_KEY, maxPlayersCount.toString());
  }

  // init active players count too
  if (!Storage.has(ACTIVE_PLAYERS_KEY)) {
    Storage.set(ACTIVE_PLAYERS_KEY, '0'.toString());
  }
}

/**
 * An async function that autonomously generates tokens
 *
 * @param {string} _args - Self-calling function for generating collectibles.
 */
export function asyncCreateCollectibles(_args: string): void {
  // get the game owner address if any
  assert(Storage.has(OWNER_ADDRESS_KEY), 'Game owner address not set');
  const gameOwnerAddress = Address.fromByteString(
      Storage.get(OWNER_ADDRESS_KEY)
  );

  // make sure this func is calling itself or the game owner is calling it
  assert(Context.callee().isValid(), 'Callee in asyncCreateCollectibles must be valid');
  assert(Context.caller().isValid(), 'Caller in asyncCreateCollectibles must be valid');
  assert(
      Context.caller().equals(Context.callee()) ||
      Context.caller().equals(gameOwnerAddress),
      'caller must be game owner or the contract itself'
  );

  const curThread = currentThread();
  const curPeriod = currentPeriod();

  // check that the current slot index is strictly higher than the last time we were called
  const lastSlotIndex: u64 = u64(parseInt(Storage.get(LAST_SLOT_INDEX_KEY)));

  const curSlotIndex: u64 = u64(curPeriod) * u64(THREADS) + u64(curThread);
  if (curSlotIndex <= lastSlotIndex) {
    return;
  }
  Storage.set(LAST_SLOT_INDEX_KEY, curSlotIndex.toString());

  // get screen width/height
  const screenWidth = Storage.get(SCREEN_WIDTH_KEY);
  const screenWidthF32: f64 = parseFloat(screenWidth);

  const screenHeight = Storage.get(SCREEN_HEIGHT_KEY);
  const screenHeightF32: f64 = parseFloat(screenHeight);

  // update some random tokens with new ones
  const tokensToUpdate = _randomUintInRange(TOTAL_ONSCREEN_TOKENS);
  for (let i: u16 = 0; i < tokensToUpdate; i++) {
    const randomTokenIndex = _randomUintInRange(TOTAL_ONSCREEN_TOKENS - 1);

    // get old token at index
    const oldTokenAtIndex = generatedTokens.get(randomTokenIndex as u16);
    // send update to all players
    _generateAsyncEvent(_formatGameEvent(TOKEN_REMOVED, oldTokenAtIndex as string));

    // generate a new token at random index and overwrite the old one
    const randomCollectibleEntity: CollectibleEntity = _generateRandomCollectible(screenWidthF32, screenHeightF32);
    generatedTokens.set(randomTokenIndex as u16, randomCollectibleEntity.serializeToString());
    // send update to all players
    _generateAsyncEvent(_formatGameEvent(TOKEN_ADDED, randomCollectibleEntity.serializeToString()));
  }

  // emit wakeup message
  const nextThreadStartValidity = curThread;
  const nextPeriodStartValidity = curPeriod + 2;
  const nextThreadEndValidity = curThread;
  const nextPeriodEndValidity = curPeriod + 5;

  // sc address
  const curAddr = Context.callee();
  assert(curAddr.isValid(), 'Caller in asyncCreateCollectibles must be valid');

  // call recursively self
  sendMessage(
      curAddr,
      'asyncCreateCollectibles',
      nextPeriodStartValidity, // validityStartPeriod
      nextThreadStartValidity, // validityStartThread
      nextPeriodEndValidity, // validityEndPeriod
      nextThreadEndValidity, // validityEndThread
      70000000,
      0,
      0,
      ''
  );
}

/**
 * Generates a random positioned massa token.
 *
 * @param {f32} screenWidth - Address of the game owner.
 * @param {f32} screenHeight - Address of the game owner.
 * @return {CollectibleEntity}- Position of the new massa token.
 */
function _generateRandomCollectible(screenWidth: f64, screenHeight: f64): CollectibleEntity {
  const randomX: f32 = (<f32>_randomCoordInRange(<f32>(screenWidth/2.0)));
  const randomY: f32 = (<f32>_randomCoordInRange(<f32>(screenHeight/2.0)));

  const posArgs: CollectibleEntity = {
    uuid: _generateUuid(),
    x: randomX,
    y: randomY,
    cbox: COLLECTIBLE_BOUNDING_BOX,
    value: COLLECTIBLE_VALUE.value() as f32,
  } as CollectibleEntity;
  return posArgs;
}


/**
 * Runs an async process checking if a player has collected a token
 *
 * @param {string} data - Self-calling function for generating collectibles.
 */
function _checkTokensCollectedAsync(data: string): void {
  const curThread = currentThread();
  const curPeriod = currentPeriod();

  let nextThread = curThread + 1;
  let nextPeriod = curPeriod;
  if (nextThread >= THREADS) {
    ++nextPeriod;
    nextThread = 0;
  }
  // sc address
  const curAddr = Context.callee();
  assert(Context.callee().isValid(), 'Callee in _checkTokenCollectedAsync must be valid');

  sendMessage(
      curAddr,
      '_checkTokensCollected',
      nextPeriod, // validityStartPeriod
      nextThread, // validityStartThread
      nextPeriod + 5, // validityEndPeriod
      nextThread, // validityEndThread
      70000000,
      0,
      0,
      data
  );
}


/**
 * Runs an async process to interpolate a given laser movement
 *
 * @param {string} laserUuid - the laser uuid to interpolate.
 */
function _interpolateLaserMovementAsync(laserUuid: string): void {
  const curThread = currentThread();
  const curPeriod = currentPeriod();

  let nextThread = curThread + 1;
  let nextPeriod = curPeriod;
  if (nextThread >= THREADS) {
    ++nextPeriod;
    nextThread = 0;
  }
  // sc address
  const curAddr = Context.callee();
  assert(Context.callee().isValid(), 'Callee in _interpolateLaserMovementAsync must be valid');

  sendMessage(
      curAddr,
      '_interpolateLaserMovement',
      nextPeriod, // validityStartPeriod
      nextThread, // validityStartThread
      nextPeriod + 5, // validityEndPeriod
      nextThread, // validityEndThread
      70000000,
      0,
      0,
      laserUuid
  );
}
