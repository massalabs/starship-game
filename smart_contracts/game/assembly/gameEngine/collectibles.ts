/* eslint-disable max-len */
import {
  Address,
  Context,
  currentPeriod,
  currentThread,
  sendMessage,
  generateEvent,
  Storage,
  collections,
} from '@massalabs/massa-as-sdk/assembly';
import {CollectibleEntity} from './entities/collectibleEntity';
import {COLLECTIBLE_BOUNDING_BOX, COLLECTIBLE_VALUE, GENERATED_TOKENS_COUNT_KEY, LAST_SLOT_INDEX_KEY, OWNER_ADDRESS_KEY, SCREEN_HEIGHT_KEY, SCREEN_WIDTH_KEY, THREADS, TOKEN_ADDED, TOKEN_REMOVED, TOTAL_ONSCREEN_TOKENS} from './config';
import {generatedTokens} from './storage';
import {_generateUuid, _randomCoordInRange, _randomUintInRange} from './utils/random';
import {_assertGameOwner} from './asserts';
import {_formatGameEvent, _generateAsyncEvent} from './events/eventEmitter';

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
export function serializeCollectiblesState(): string {
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
export function deserializeCollectiblesState(args: string): collections.PersistentMap<u16, string> {
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
export function cleanCollectiblesState(map: collections.PersistentMap<u16, string>): void {
  for (let tokenIndex: u16 = 0; tokenIndex < map.size(); tokenIndex++) {
    map.delete(tokenIndex);
  }
}

/**
 * Initiates the collectibles state, i.e. first generation round
 *
 * @param {string} _args - ?.
 */
export function setInitialCollectiblesState(_args: string): void {
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
export function stopCreatingCollectibles(_args: string): void {
  // check that the caller is the game owner
  assert(_assertGameOwner(Context.caller()));
  Storage.set(LAST_SLOT_INDEX_KEY, '2000000000');
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
export function _generateRandomCollectible(screenWidth: f64, screenHeight: f64): CollectibleEntity {
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
export function _checkTokensCollectedAsync(data: string): void {
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
