import {token} from '@massalabs/massa-as-sdk/assembly';

const allowance = token.allowance;
export {allowance};

const balanceOf = token.balanceOf;
export {balanceOf};

const increaseAllowance = token.increaseAllowance;
export {increaseAllowance};

const decreaseAllowance = token.decreaseAllowance;
export {decreaseAllowance};

const symbol = token.symbol;
export {symbol};

const totalSupply = token.totalSupply;
export {totalSupply};

const transfer = token.transfer;
export {transfer};

const transferFrom = token.transferFrom;
export {transferFrom};

const decimals = token.decimals;
export {decimals};

const version = token.version;
export {version};

// For this example we just want to rename the token
// Everything else will be kept as defined in the mscl-token/erc20 module

/**
 * Overwrites `name` function with wanted functionality.
 *
 * @param {string} _ - unused but mandatory. See https://github.com/massalabs/massa-sc-std/issues/18
 * @return {string} - the new token name.
 */
export function name(_: string): string {
  return 'Massa Example token';
}
