/* eslint-disable max-len */
import {
  Address,
  Storage,
} from '@massalabs/massa-as-sdk/assembly';
import {ACTIVE_PLAYERS_KEY, MAX_PLAYERS_KEY, OWNER_ADDRESS_KEY} from './config';
import {registeredPlayers} from './storage';

/**
 * Returns if the Player Address has been registered or not.
 * @param {Address} address - Address of the player.
 * @return {bool} indicates if player is registered or not.
 */
export function _isPlayerRegistered(address: Address): bool {
  return registeredPlayers.contains(address.toByteString());
}

/**
 * Returns if the an Address is a game owner or not. Returns true if no game ower is yet set
 * @param {Address} caller - Caller to be compared with the game owner in storage.
 * @return {bool}
 */
export function _assertGameOwner(caller: Address): bool {
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
export function _checkMaxPlayersLimit(): bool {
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
