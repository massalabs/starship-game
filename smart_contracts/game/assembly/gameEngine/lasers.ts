/* eslint-disable max-len */
import {
  Address,
  Context,
  currentPeriod,
  currentThread,
  sendMessage,
  env,
} from '@massalabs/massa-as-sdk/assembly';
import {THREADS} from './config';
import {SetPlayerLaserRequest} from './requests/SetPlayerLaserRequest';
import {laserStates, spawnedLaserInterpolators, playerLaserUuids, playerTokensUuids} from './storage';
import {_isPlayerRegistered} from './asserts';
import {LaserToInterpolate} from './events/laserToInterpolate';

/**
 * Runs an async process to interpolate a given laser movement
 * 1. interpolate the given laser movement
 * 2. check for out-of-bound lasers and update state
 *
 * @param {string} serializedDataPayload - serialized data payload of type LaserToInterpolate
 */
export function _interpolateLaserMovementAsync(serializedDataPayload: string): void {
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
      serializedDataPayload
  );
}

/**
 * Interpolates a given laser movement
 *
 * @param {Entity} _args - ?
 */
export function _interpolateLaserMovement(_args: string): void {
  // check that the caller is the contract itself
  assert(Context.callee().isValid(), 'Callee in _interpolateLaserMovement must be valid');
  assert(Context.caller().isValid(), 'Caller in _interpolateLaserMovement must be valid');
  assert(Context.callee().equals(Context.caller()));

  const deserializedLaserToInterpolateEvent = LaserToInterpolate.parseFromString(_args);
  const laserUuid = deserializedLaserToInterpolateEvent.laserUuid;
  const timeStep = env.env.time() as f64 - deserializedLaserToInterpolateEvent.time;

  const playerLaserState = laserStates.get(laserUuid);
  if (playerLaserState) {
    // env.env.time()
  }
}

/**
 * Sets the player's lasers data at a given time T
 *
 * @param {string} _args - stringified PlayArgs.
 */
export function setPlayerLaserPos(_args: string): void {
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
    spawnedLaserInterpolators.set(playerLaserUpdate.uuid, 'true');

    // run an async function to:
    // 1. interpolate the given laser movement
    // 2. check for out-of-bound lasers and update state
    const eventData: LaserToInterpolate = {
      laserUuid: playerLaserUpdate.uuid,
      time: env.env.time() as f64,
    } as LaserToInterpolate;
    _interpolateLaserMovementAsync(eventData.serializeToString());
  }
}
