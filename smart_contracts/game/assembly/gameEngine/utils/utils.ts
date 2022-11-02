import {
  unsafeRandom,
} from '@massalabs/massa-as-sdk/assembly';

export const mapStrToU8 = (data: string): StaticArray<u8> => {
  const newData = data.split(',');
  const ret = new StaticArray<u8>(newData.length);
  for (let i = 0; i < newData.length; i++) {
    ret[i] = U8.parseInt(newData.at(i));
  }
  return ret;
};

export const mapStrToBool = (val: string): boolean => {
  if (val.toLowerCase() === 'true') return true;
  return false;
};

/**
 * Generates a random value with a limiting upper range.
 *
 * @param {i64} range - limiting range.
 * @return {u64}- value scaled in range.
 */
export function _randomUintInRange(range: i64): u64 {
  const random: i64 = unsafeRandom();
  const mod = random % range;
  return <u64>Math.abs(<f64>mod);
}

/**
 * Generates a random value with a limiting upper range.
 *
 * @param {f32} range - limiting range.
 * @return {f32}- value scaled in range.
 */
export function _randomCoordInRange(range: f32): f32 {
  const absRange = <i64>Math.abs(range);
  const random: i64 = unsafeRandom();
  const mod = random % absRange;
  if (random > 0) {
    return <f32>Math.abs(<f64>mod);
  } else {
    return <f32>Math.abs(<f64>mod) * -1.0;
  }
}

/**
 * Generates a random uuid.
 * @return {string} uuid as string
 */
export function _generateUuid(): string {
  return `uuid-${(<i64>Math.abs(<f64>unsafeRandom())).toString()}`;
}
