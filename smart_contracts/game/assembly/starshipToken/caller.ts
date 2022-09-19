import {
  fileToBase64, createSC, Address, print, generateEvent,
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
  // Reads erc20_create.wasm file, encodes it in base64 and
  //   sets the result to `bytecode` variable.
  // There is a transformer that can do that, but it's not working
  //   with assemblyscript 0.20 (see https://github.com/massalabs/massa-sc-library/pull/29).
  // Therefore, this transformation is done at compilation time
  //   (see asbuild:use script in package.json).
  const bytecode = fileToBase64('./build/starshipToken.wasm');

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
  print('Created token smart-contract at:' + scAddress._value);
  generateEvent(`Address:${scAddress._value}`);
  return 0;
}
