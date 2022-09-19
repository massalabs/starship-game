import {
  fileToBase64,
  createSC,
  generateEvent,
  Address,
} from '@massalabs/massa-as-sdk/assembly';

/**
 * Loads a smart contract into Massa blockchain.
 *
 * A smart contract is a WebAssembly module read from a wasm file
 * and encoded into base64.
 * `create_sc` takes that smart contract, sends it to the blockchain
 * and returns its address.
 *
 * @return {Address} - Address of the smart contract loaded into the blockchain.
 */
function loadSC(): Address {
  const bytecode = fileToBase64('./build/gameEngine.wasm');

  // Adds a new smart contract to the ledger and returns its address.
  return createSC(bytecode);
}

/**
 * Main function called at smart contract runtime.
 *
 * @param {string} _ - unused but mandatory. See https://github.com/massalabs/massa-sc-std/issues/18
 * @return {i32} - ?
 */
export function main(_: string): i32 {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  const scAddress = loadSC();
  generateEvent(`Address:${scAddress._value}`);
  return 0;
}
