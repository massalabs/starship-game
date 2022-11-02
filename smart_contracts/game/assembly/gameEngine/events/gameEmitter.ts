/* eslint-disable max-len */

import {
  Context,
  currentPeriod,
  currentThread,
  generateEvent,
  sendMessage,
  env,
} from '@massalabs/massa-as-sdk/assembly';
import {THREADS} from '../config';
import {GameEvent} from './gameEvent';

/**
   * Generates an async game event sent out by the sc
   *
   * @param {string} data - the packed and serialized game event data.
   */
export function _generateAsyncEvent(data: string): void {
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
  assert(Context.callee().isValid(), 'Callee in _generateEvent must be valid');

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

/**
 * Sends an game event
 *
 * @param {string} data - the packed and serialized game event data.
 */
export function _sendGameEvent(data: string): void {
  assert(Context.callee().isValid(), 'Callee in _sendGameEvent must be valid');
  assert(Context.caller().isValid(), 'Caller in _sendGameEvent must be valid');

  // check that the caller is the contract itself
  assert(Context.callee().equals(Context.caller()));

  // construct and send the event
  const gameEvent: GameEvent = {
    data,
    time: <f64>env.env.time(), // unix time in milliseconds
  } as GameEvent;

  // send the game event
  generateEvent(`${gameEvent.serializeToString()}`);
}

/**
 * Formats a game event in the expected format.
 * @param {string} gameEventName - Game event name
 * @param {string} gameEventData - Game event data
 * @return {string} the formatted game event.
 */
export function _formatGameEvent(gameEventName: string, gameEventData: string): string {
  return `${gameEventName}=${gameEventData}`;
}
