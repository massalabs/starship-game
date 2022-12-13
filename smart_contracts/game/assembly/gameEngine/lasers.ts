/* eslint-disable max-len */
import {
  Address,
  Context,
  currentPeriod,
  currentThread,
  sendMessage,
  env,
  Storage,
  generateEvent,
} from '@massalabs/massa-as-sdk/assembly';
import {LASER_OUT_OF_BOUNDS, LASER_VELOCITY, NEW_LASER, SCREEN_HEIGHT_KEY, SCREEN_WIDTH_KEY, THREADS} from './config';
import {SetPlayerLaserRequest} from './requests/SetPlayerLaserRequest';
import {laserStates, spawnedLaserInterpolators, playerLaserUuids} from './storage';
import {_isPlayerRegistered} from './asserts';
import {LaserToInterpolate} from './events/laserToInterpolate';
import {LaserEntity} from './entities/laserEntity';
import {_formatGameEvent, _generateAsyncEvent, _sendGameEvent} from './events/eventEmitter';
import {NewLaserShotEvent} from './events/newLaserShot';
import {LaserDestroyedEvent} from './events/laserDestroyedEvent';

/**
 * Runs an async process to interpolate a given laser movement
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
 * 1. interpolate the given laser movement
 * 2. check for out-of-bound lasers and update state
 *
 * @param {Entity} _args - ?
 */
export function _interpolateLaserMovement(_args: string): void {
  // check that the caller is the contract itself
  assert(Context.callee().isValid(), 'Callee in _interpolateLaserMovement must be valid');
  assert(Context.caller().isValid(), 'Caller in _interpolateLaserMovement must be valid');
  assert(Context.callee().equals(Context.caller()));

  // sc address
  const curAddr = Context.callee();
  assert(Context.callee().isValid(), 'Callee in _interpolateLaserMovement must be valid');

  // compute next available thread
  generateEvent(`INTERPOLATING LASER MOVEMENT CYCLE BEFORE ${_args}`);
  const curThread = currentThread();
  const curPeriod = currentPeriod();

  let nextThread = curThread + 1;
  let nextPeriod = curPeriod;
  if (nextThread >= THREADS) {
    ++nextPeriod;
    nextThread = 0;
  }

  // compute the interpolation increment
  const deserializedLaserToInterpolateEvent = LaserToInterpolate.parseFromString(_args);
  const laserUuid = deserializedLaserToInterpolateEvent.laserUuid;
  const timeStep = (env.env.time() as f64 - deserializedLaserToInterpolateEvent.time) / 1000.0 as f64; // in seconds // time() = unix time in milliseconds
  const playerLaserStateSerialized = laserStates.get(laserUuid);

  if (playerLaserStateSerialized && spawnedLaserInterpolators.get(laserUuid)) {
    const laserState = LaserEntity.parseFromString(playerLaserStateSerialized);
    const deltaX = laserState.xx * LASER_VELOCITY * timeStep;
    const deltaY = laserState.yy * LASER_VELOCITY * timeStep;
    laserState.x += deltaX as f32;
    laserState.y += deltaY as f32;
    const screenHeight = Storage.get(SCREEN_HEIGHT_KEY);
    const screenHeightF32: f64 = parseFloat(screenHeight);
    const screenWidth = Storage.get(SCREEN_WIDTH_KEY);
    const screenWidthF32: f64 = parseFloat(screenWidth);
    generateEvent(`INTERPOLATING LASER MOVEMENT CYCLE AFTER ${laserState.serializeToString()}. TIME DIFF = ${timeStep}`);
    // check for outside of bounds
    if (Math.abs(laserState.x) > screenWidthF32 || Math.abs(laserState.y) > screenHeightF32) {
      generateEvent(`LASER OUT OF BOUNDS :: DELETED ${laserState.uuid}`);
      laserStates.delete(laserState.uuid);
      spawnedLaserInterpolators.delete(laserState.uuid);
      // remove the laser from the user
      const playerConcatenatedLaserUuids = playerLaserUuids.get(deserializedLaserToInterpolateEvent.shooterAddress);
      if (playerConcatenatedLaserUuids) {
        const uuidsArray = playerConcatenatedLaserUuids.split(',');
        let indexToRemove = -1;
        for (let i = 0; i < uuidsArray.length; i++) {
          if (uuidsArray[i] === laserState.uuid) {
            indexToRemove = i;
          }
        }
        if (indexToRemove > -1) {
          uuidsArray.splice(indexToRemove, 1);
          playerLaserUuids.set(deserializedLaserToInterpolateEvent.shooterAddress, uuidsArray.join(','));
        }
      }

      // emit an event
      const laserDestroyedEventData: LaserDestroyedEvent = {
        laserUuid: laserState.uuid,
        shooterUuid: deserializedLaserToInterpolateEvent.shooterUuid,
        shooterAddress: deserializedLaserToInterpolateEvent.shooterAddress,
        time: env.env.time() as f64,
      } as LaserDestroyedEvent;
      _sendGameEvent(_formatGameEvent(LASER_OUT_OF_BOUNDS, laserDestroyedEventData.serializeToString()));
      return;
    }

    // set the updated laser state
    laserStates.set(laserState.uuid, laserState.serializeToString());

    // prepare proxy message
    const eventData: LaserToInterpolate = {
      laserUuid: laserUuid,
      time: env.env.time() as f64,
    } as LaserToInterpolate;

    // trigger a new cycle
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
        eventData.serializeToString()
    );
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
  generateEvent(`NEW LASER UPDATE ${playerLaserUpdate.serializeToString()}`);

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
  playerLaserUuids.set(playerLaserUpdate.playerAddress, playerActiveLasersSerialized);

  // add the laser uuid to the laser states map if needed
  if (!laserStates.contains(playerLaserUpdate.uuid)) {
    const laserState: LaserEntity = {
      uuid: playerLaserUpdate.uuid,
      x: playerLaserUpdate.x,
      y: playerLaserUpdate.y,
      xx: playerLaserUpdate.xx,
      yy: playerLaserUpdate.yy,
    } as LaserEntity;
    laserStates.set(playerLaserUpdate.uuid, laserState.serializeToString());
  }

  // check for spawned async interpolator, if not, spawn one and mark it
  if (!spawnedLaserInterpolators.contains(playerLaserUpdate.uuid)) {
    spawnedLaserInterpolators.set(playerLaserUpdate.uuid, 'true');

    // emit an event
    const laserShotEventData: NewLaserShotEvent = {
      laserUuid: playerLaserUpdate.uuid,
      shooterUuid: playerLaserUpdate.playerUuid,
      shooterAddress: playerLaserUpdate.playerAddress,
      time: env.env.time() as f64,
    } as NewLaserShotEvent;

    // generate a message
    const eventMessage = _formatGameEvent(NEW_LASER, laserShotEventData.serializeToString());

    // send async event from sc to all players
    _generateAsyncEvent(eventMessage);

    // run an async function to:
    // 1. interpolate the given laser movement
    // 2. check for out-of-bound lasers and update state
    const eventData: LaserToInterpolate = {
      laserUuid: playerLaserUpdate.uuid,
      shooterUuid: playerLaserUpdate.playerUuid,
      shooterAddress: playerLaserUpdate.playerAddress,
      time: env.env.time() as f64,
    } as LaserToInterpolate;
    _interpolateLaserMovementAsync(eventData.serializeToString());
  }
}
