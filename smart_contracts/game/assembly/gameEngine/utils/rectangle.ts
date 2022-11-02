/* eslint-disable require-jsdoc */

/**
 * The Massa's standard token implementation wrapper.
 *
 * This class can be used to wrap a smart contract implementing
 * Massa standard token.
 * All the serialization/deserialization will handled here.
 *
 * ```assembyscript
 *  ...
 *  const coin = new TokenWrapper(sc_address);
 *  const coinName = coin.Name();
 *  const bal = coin.BalanceOf(myAddress);
 *  print("balance: " + bal.toString() + " of token: " + coinName);
 * ...
 * ```
 */

import {JSON} from 'json-as/assembly';

 @json
export class Rectangle {
  left: f32;
  right: f32;
  top: f32;
  bottom: f32;

  /**
   * Sets rectangle box arguments
   *
   * @param {f32} left - left.
   * @param {f32} right - right.
   * @param {f32} top - top
   * @param {f32} bottom - bottom
   */
  constructor(left: f32, right: f32, top: f32, bottom: f32) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
  }
}

/**
 * Checks if 2 rectangles intersect or not
 *
 * @param {Rectangle} r1 - first rectangle.
 * @param {Rectangle} r2 - second rectangle.
 * @return {boolean} if the rectangles intersect.
 */
export function _isIntersection(r1: Rectangle, r2: Rectangle): boolean {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top < r1.bottom ||
    r2.bottom > r1.top
  );
}
