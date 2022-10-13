/* eslint-disable max-len */
/* Smart Contract Implementation of the Starship Game Logic
 *
 * */
import {
  Storage,
  Address,
  unsafeRandom,
  Context,
  currentPeriod,
  currentThread,
  generateEvent,
  sendMessage,
  token,
  collections,
  env,
} from '@massalabs/massa-as-sdk/assembly';
import {Amount} from '@massalabs/as/assembly';
import {Rectangle, _isIntersection} from './rectangle';
import {PlayerEntity} from './playerEntity';
import {CollectibleEntity} from './collectibleEntity';
import {CollectedEntity} from './collectedEntity';
import {GameEvent} from './gameEvent';

// storage keys
const REGISTERED_PLAYERS_MAP_KEY = 'registered_players_map_key';
const REGISTERED_PLAYERS_STATES_MAP_KEY = 'registered_players_states_key';
const REGISTERED_PLAYERS_TOKENS_MAP_KEY = 'registered_players_tokens_key';
const GENERATED_TOKENS_MAP_KEY = 'generated_tokens_key';
const OWNER_ADDRESS_KEY = 'owner_key';
const LAST_SLOT_INDEX_KEY = 'last_slot_index_key';
const TOKEN_ADDRESS_KEY = 'token_address_key';
const GENERATED_TOKENS_COUNT_KEY = 'state_key';
const SCREEN_WIDTH_KEY = 'screen_width_key';
const SCREEN_HEIGHT_KEY = 'screen_height_key';
const MAX_PLAYERS_KEY = 'max_players_key';
const ACTIVE_PLAYERS_KEY = 'active_players_key';

// events

// game owner
const TOKEN_ADDRESS_ADDED = 'TOKEN_ADDRESS_ADDED';
const GAME_OWNER_ADDRESS_ADDED = 'GAME_OWNER_ADDRESS_ADDED';

// player
const PLAYER_ADDED = 'PLAYER_ADDED';
const PLAYER_REMOVED = 'PLAYER_REMOVED';
const PLAYER_MOVED = 'PLAYER_MOVED';

// tokens
const TOKEN_ADDED = 'TOKEN_ADDED';
const TOKEN_REMOVED = 'TOKEN_REMOVED';
const TOKEN_COLLECTED = 'TOKEN_COLLECTED';

// screen
const SCREEN_WIDTH_ADJUSTED = 'SCREEN_WIDTH_ADJUSTED';
const SCREEN_HEIGHT_ADJUSTED = 'SCREEN_HEIGHT_ADJUSTED';

// settings
const THREADS: u8 = 32;
const NEW_COLLECTIBLES_GENERATION_IN_THREADS: u8 = 100;
const TOTAL_ONSCREEN_TOKENS: u16 = 10;
const COLLECTIBLE_BOUNDING_BOX: f32 = 50.0;
const PLAYER_BOUNDING_BOX: f32 = 64.0;
const COLLECTIBLE_VALUE: Amount = new Amount(1);
const COLLECTIONS_SEPARATOR: string = '@';

// registered players map
export const registeredPlayers = new collections.PersistentMap<string, boolean>(
    REGISTERED_PLAYERS_MAP_KEY
);

// registered players states map
export const playerStates = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_STATES_MAP_KEY
);

// registered players tokens map
export const playerTokens = new collections.PersistentMap<string, string>(
    REGISTERED_PLAYERS_TOKENS_MAP_KEY
);

// generated tokens map
export const generatedTokens = new collections.PersistentMap<u16, string>(
    GENERATED_TOKENS_MAP_KEY
);

/**
 * Generates a random uuid.
 * @return {string} uuid as string
 */
function _generateUuid(): string {
  return `uuid-${(<i64>Math.abs(<f64>unsafeRandom())).toString()}`;
}

/**
 * Returns if the Player Address has been registered or not.
 * @param {string} gameEventName - Address of the player.
 * @param {string} gameEventData - Address of the player.
 * @return {string} the formatted game event.
 */
function _formatGameEvent(gameEventName: string, gameEventData: string): string {
  return `${gameEventName}=${gameEventData}`;
}

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
 * Sets the screen width
 * @param {string} screenWidth - Screen width to set.
 */
export function setScreenWidth(screenWidth: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(SCREEN_WIDTH_KEY, screenWidth);

  // send event to all players
  _generateEvent(_formatGameEvent(SCREEN_WIDTH_ADJUSTED, screenWidth));
}

/**
 * Sets the screen width
 * @param {string} screenHeight - Screen width to set.
 */
export function setScreenHeight(screenHeight: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(SCREEN_HEIGHT_KEY, screenHeight);

  // send event to all players
  _generateEvent(_formatGameEvent(SCREEN_HEIGHT_ADJUSTED, screenHeight));
}

/**
 * Sets the token address
 * @param {string} tokenAddress - Address of the token.
 */
export function addTokenAddress(tokenAddress: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(TOKEN_ADDRESS_KEY, tokenAddress.toString());

  // send event to all players
  _generateEvent(_formatGameEvent(TOKEN_ADDRESS_ADDED, tokenAddress.toString()));
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

  // send event to all players
  _generateEvent(_formatGameEvent(GAME_OWNER_ADDRESS_ADDED, Context.caller().toByteString()));
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
 * Register a new player.
 *
 * @param {string} address - Address of the player.
 */
export function registerPlayer(address: string): void {
  // read player address
  const addr = Address.fromByteString(address);

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

  // set storage
  const playerEntity: PlayerEntity = {
    uuid: _generateUuid(),
    address: addr.toByteString(),
    x: 0.0,
    y: 0.0,
    rot: 90.0,
    cbox: PLAYER_BOUNDING_BOX,
  } as PlayerEntity;
  const serializedPlayerData: string = playerEntity.serializeToString();
  playerStates.set(addr.toByteString(), serializedPlayerData);

  // increase active players count
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  Storage.set(ACTIVE_PLAYERS_KEY, (currentPlayersCount + 1).toString());

  // generate a message
  const eventMessage = _formatGameEvent(PLAYER_ADDED, serializedPlayerData);

  // send event from caller
  generateEvent(eventMessage);

  // send event from sc to all players
  _generateEvent(eventMessage);
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
  playerStates.delete(addr.toByteString());
  if (playerTokens.get(addr.toByteString())) {
    playerTokens.delete(addr.toByteString());
  }

  // decrease active players count
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  const newCount = currentPlayersCount - 1;
  Storage.set(ACTIVE_PLAYERS_KEY, newCount < 0 ? '0'.toString() : newCount.toString());

  // generate a message
  const eventMessage = _formatGameEvent(PLAYER_REMOVED, playerEntity.serializeToString());

  // send event from caller
  generateEvent(eventMessage);

  // send event to all players
  _generateEvent(eventMessage);
}

/**
 * Moves the player by setting absolute coordinates.
 *
 * @param {string} _args - stringified PlayArgs.
 */
export function setAbsCoors(_args: string): void {
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
  // _checkTokenCollected(playerEntityUpdate);

  // send event
  _generateEvent(_formatGameEvent(PLAYER_MOVED, serializedPlayerData));
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
  const tokens = playerTokens.get(playerAddress.toByteString());
  let tokenCount = 0;
  if (tokens) {
    tokenCount = tokens.split('@').length;
  }
  // return player tokens
  generateEvent(`${tokenCount.toString()}`);
  return tokenCount.toString();
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
  // return player balance
  const res = collToken.balanceOf(playerAddress).value().toString();
  generateEvent(`${res}`);
  return res;
}

/**
 * Returns the massa tokens state.
 * @param {string} _args - ?
 * @return {string} - the stringified massa tokens state.
 */
export function getCollectiblesState(_args: string): string {
  const generatedRandomTokens: Array<string> = [];
  for (let tokenIndex: u16 = 0; tokenIndex < TOTAL_ONSCREEN_TOKENS; tokenIndex++) {
    const randomCollectibleEntity = generatedTokens.get(tokenIndex);
    generatedRandomTokens.push(randomCollectibleEntity as string);
  }
  const res = generatedRandomTokens.join('@');
  generateEvent(`${res}`);
  return res;
}

/**
 * Moves the player to a certain position by an increment.
 *
 * @param {string} _args - stringified PlayArgs.
 */
export function moveByInc(_args: string): void {
  // read current increments
  const newPlayerPos = PlayerEntity.parseFromString(_args);

  // check that player is already registered
  assert(
      _isPlayerRegistered(new Address(newPlayerPos.address)),
      'Player has not been registered'
  );

  // TODO: verify that is one of the player signing addresses (thread addresses) + it has the right address and uuid
  // also verify coords against cheating ????

  // read old player position
  const storedPlayerSerialized = playerStates.get(
      newPlayerPos.address
  ); // infallible as we have checked the condition above
  const storedPlayerEntity = PlayerEntity.parseFromString(
    <string>storedPlayerSerialized
  );

  // update player coords
  storedPlayerEntity.x += newPlayerPos.x;
  storedPlayerEntity.y = newPlayerPos.y;
  storedPlayerEntity.rot += newPlayerPos.rot;

  // serialize player data
  const serializedPlayerEntity = storedPlayerEntity.serializeToString();

  // update storage
  playerStates.set(
      storedPlayerEntity.address,
      serializedPlayerEntity
  );

  // check if player has collected a token based on his pos
  // _checkTokenCollected(storedPlayerEntity);

  // send event to all players
  _generateEvent(_formatGameEvent(PLAYER_MOVED, serializedPlayerEntity));
}

/**
 * Check if a player has collected a token.
 *
 * @param {Entity} playerPos - Position of the player.
 */
function _checkTokenCollected(playerPos: PlayerEntity): void {
  const playerCbox = new Rectangle(
      playerPos.x - playerPos.cbox,
      playerPos.x + playerPos.cbox,
      playerPos.y + playerPos.cbox,
      playerPos.y - playerPos.cbox
  );

  for (let i: u16 = 0; i < TOTAL_ONSCREEN_TOKENS; i++) {
    const collectibleEntity = CollectibleEntity.parseFromString(
        <string>generatedTokens.get(i)
    );
    const collectibleCbox = new Rectangle(
        collectibleEntity.x - collectibleEntity.cbox,
        collectibleEntity.x + collectibleEntity.cbox,
        collectibleEntity.y + collectibleEntity.cbox,
        collectibleEntity.y - collectibleEntity.cbox
    );

    if (_isIntersection(playerCbox, collectibleCbox)) {
      _playerCollectibleClaim(
          new Address(playerPos.address),
          new Amount(<u64>collectibleEntity.value)
      );

      // add token to player collected tokens
      let storedPlayerTokensSerialized = playerTokens.get(
          playerPos.address
      );

      // append currently collected token to state
      const collectedEntity: CollectedEntity = {
        uuid: collectibleEntity.uuid,
        playerUuid: playerPos.uuid,
        value: collectibleEntity.value,
        time: env.env.time() as f64,
      } as CollectedEntity;
      if (storedPlayerTokensSerialized) {
        storedPlayerTokensSerialized = storedPlayerTokensSerialized.concat(COLLECTIONS_SEPARATOR).concat(collectedEntity.serializeToString());
      } else {
        storedPlayerTokensSerialized = collectedEntity.serializeToString();
      }

      // add update back to hashmap
      playerTokens.set(playerPos.address, storedPlayerTokensSerialized);

      // generate an event and send to all players
      _generateEvent(_formatGameEvent(TOKEN_COLLECTED, collectedEntity.serializeToString()));
    }
  }
}

/**
 * Player collects a token.
 *
 * @param {Address} playerAddress - Address of the player.
 * @param {Address} collectibleValue - Value of the collectible.
 */
function _playerCollectibleClaim(
    playerAddress: Address,
    collectibleValue: Amount
): void {
  // transfer token to player
  const tokenAddress = Address.fromByteString(Storage.get(TOKEN_ADDRESS_KEY));
  // get collectible impl wrapper
  const collToken = new token.TokenWrapper(tokenAddress);
  // token transfers X amount to player
  collToken.transfer(playerAddress, collectibleValue);
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
 * Stop creating collectibles.
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
 * Stop creating collectibles.
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
  if (!Storage.has(MAX_PLAYERS_KEY)) {
    Storage.set(MAX_PLAYERS_KEY, '0'.toString());
  }
}

/**
 * Player collects a token.
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
  assert(
      Context.caller().equals(Context.callee()) ||
      Context.caller().equals(gameOwnerAddress),
      'caller must be game owner or the contract itself'
  );

  const curThread = currentThread();
  const curPeriod = currentPeriod();

  // generateEvent(
  //     `asyncCreateCollectibles called (thread = ${curThread}, period = ${curPeriod}))`
  // );

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
    const randomCollectibleEntity: CollectibleEntity = _generateRandomCollectible(screenWidthF32, screenHeightF32);
    const tokenIndex = _randomUintInRange(TOTAL_ONSCREEN_TOKENS - 1);

    // get old token at index
    const oldTokenAtIndex = generatedTokens.get(tokenIndex as u16);
    // send update to all players
    _generateEvent(_formatGameEvent(TOKEN_REMOVED, oldTokenAtIndex as string));

    // generate a new token at random index and overwrite the old one
    generatedTokens.set(tokenIndex as u16, randomCollectibleEntity.serializeToString());
    // send update to all players
    _generateEvent(_formatGameEvent(TOKEN_ADDED, randomCollectibleEntity.serializeToString()));
  }

  // emit wakeup message
  let nextThread = 31 as u8; // choose max. delay
  let nextPeriod = curPeriod;
  if (nextThread >= THREADS) {
    ++nextPeriod;
    nextThread = 0;
  }
  // sc address
  const curAddr = Context.callee();

  // call recursively self
  sendMessage(
      curAddr,
      'asyncCreateCollectibles',
      nextPeriod, // validityStartPeriod
      nextThread, // validityStartThread
      nextPeriod + NEW_COLLECTIBLES_GENERATION_IN_THREADS, // validityEndPeriod
      nextThread, // validityEndThread
      70000000,
      0,
      0,
      ''
  );

  // generateEvent(
  //   `asyncCreateCollectibles finished (thread = ${curThread}, period = ${curPeriod}))`
  // );
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
 * Generates a random value with a limiting upper range.
 *
 * @param {f32} range - limiting range.
 * @return {f32}- value scaled in range.
 */
function _randomCoordInRange(range: f32): f32 {
  const absRange = <i64>Math.abs(range);
  const random: i64 = unsafeRandom();
  const mod = random % absRange;
  if (random > 0) {
    return <f32>Math.abs(<f64>mod);
  } else {
    return <f32>Math.abs(<f64>mod) * -1.0; // <f32>Math.abs(<f64>mod) * -1.0 depending on the axis
  }
}

/**
 * Generates a random value with a limiting upper range.
 *
 * @param {i64} range - limiting range.
 * @return {u64}- value scaled in range.
 */
function _randomUintInRange(range: i64): u64 {
  const random: i64 = unsafeRandom();
  const mod = random % range;
  return <u64>Math.abs(<f64>mod);
}

/**
 * Player collects a token.
 *
 * @param {string} data - Self-calling function for generating collectibles.
 */
export function _sendGameEvent(data: string): void {
  // check that the caller is the contract itself
  assert(Context.callee().equals(Context.caller()));

  const gameEvent: GameEvent = {
    data,
    time: <f64>env.env.time(), // unix time in milliseconds
  } as GameEvent;
  generateEvent(`${gameEvent.serializeToString()}`);
}

/**
 * Player collects a token.
 *
 * @param {string} data - Self-calling function for generating collectibles.
 */
function _generateEvent(data: string): void {
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

  sendMessage(
      curAddr,
      '_sendGameEvent',
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

