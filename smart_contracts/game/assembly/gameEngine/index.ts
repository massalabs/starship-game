/* eslint-disable max-len */
/* Smart Contract Implementation of the Starship Multiplayer Game Server
 *
 * */

// ====================================== IMPORTS ======================================
import {
  Storage,
  Context,
  generateEvent,
} from '@massalabs/massa-as-sdk/assembly';
import {_formatGameEvent, _generateAsyncEvent} from './events/eventEmitter';
import {
  ACTIVE_PLAYERS_KEY,
  GAME_OWNER_ADDRESS_ADDED,
  LAST_SLOT_INDEX_KEY,
  MAX_PLAYERS_KEY,
  OWNER_ADDRESS_KEY,
  SCREEN_HEIGHT_ADJUSTED,
  SCREEN_HEIGHT_KEY,
  SCREEN_WIDTH_ADJUSTED,
  SCREEN_WIDTH_KEY,
  TOKEN_ADDRESS_ADDED,
  TOKEN_ADDRESS_KEY,
} from './config';
import {_assertGameOwner} from './asserts';

// ====================================== EXPORTS ======================================
// lasers
export {_interpolateLaserMovementAsync, _interpolateLaserMovement, setPlayerLaserPos} from './lasers';

// collectibles
export {_checkTokensCollectedAsync,
  asyncCreateCollectibles,
  _generateRandomCollectible,
  cleanCollectiblesState,
  deserializeCollectiblesState,
  getCollectiblesState,
  serializeCollectiblesState,
  setInitialCollectiblesState,
  stopCreatingCollectibles} from './collectibles';

// events
export {_generateAsyncEvent, _sendGameEvent} from './events/eventEmitter';

// players
export {_playerCollectibleClaim,
  getActivePlayersAddresses,
  getPlayerBalance,
  getPlayerExecutors,
  getPlayerLasersUuids,
  getPlayerPos,
  getPlayerTokens,
  getRegisteredPlayerUuid,
  isPlayerRegistered,
  registerPlayer,
  removePlayer,
  setPlayerAbsCoors,
  getActivePlayersCount,
  _checkTokensCollected,
  getMaximumPlayersCount} from './players';

// storage
export {
  playerExecutors,
  playerLaserUuids,
  playerStates,
  playerTokensCount,
  playerTokensUuids,
  registeredPlayers} from './storage';

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
 * Set Last Slot Index
 *
 * @param {string} _args - ?.
 */
export function initLastSlotIndex(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(LAST_SLOT_INDEX_KEY, '0');
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
