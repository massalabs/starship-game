/* eslint-disable max-len */
/* Smart Contract Implementation of the Starship Multiplayer Game Server
 *
 * */
// ====================================== IMPORTS ======================================
import {
  Context,
  Storage,
  Address,
  generateEvent,
  token,
  env,
  collections,
} from '@massalabs/massa-as-sdk/assembly';
import {Amount, Currency} from '@massalabs/as/assembly';
import {PlayerEntity} from './entities/playerEntity';
import {_formatGameEvent, _generateAsyncEvent, _sendGameEvent} from './events/eventEmitter';
import {RegisterPlayerRequest} from './requests/RegisterPlayerRequest';
import {PlayerTokenCollected} from './events/playerTokenCollected';
import {_generateUuid} from './utils/random';
import {ACTIVE_PLAYERS_ADDRESSES_KEY,
  ACTIVE_PLAYERS_KEY,
  MAX_PLAYERS_KEY,
  PLAYER_ADDED,
  PLAYER_BOUNDING_BOX,
  PLAYER_REMOVED,
  SCREEN_HEIGHT_KEY,
  TOKEN_ADDRESS_KEY,
  TOKEN_COLLECTED,
} from './config';
import {_checkMaxPlayersLimit, _isPlayerRegistered} from './asserts';
import {
  playerExecutors,
  playerLaserUuids,
  playerStates,
  playerTokensCount,
  playerTokensUuids,
  registeredPlayers} from './storage';
import {_checkTokensCollectedAsync, serializeCollectiblesState, cleanCollectiblesState, deserializeCollectiblesState} from './collectibles';
import {Rectangle, _isIntersection} from './utils/rectangle';
import {CollectibleEntity} from './entities/collectibleEntity';
import {CollectedEntityEvent} from './events/collectedEntityEvent';

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
 * Player collects a token.
 *
 * @param {Address} playerAddress - Address of the player.
 * @param {Address} collectibleValue - Value of the collectible.
 */
export function _playerCollectibleClaim(
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
 * Returns the active player addresses
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
 * Returns if the Player Address has been registered or not.
 * @param {string} _args - Address of the player.
 * @return {string} the player uuid
 */
export function getActivePlayersCount(_args: string): string {
  const currentPlayersCount = parseInt(Storage.get(ACTIVE_PLAYERS_KEY), 10);
  // return the entity uuid
  generateEvent(`${currentPlayersCount.toString()}`);
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
