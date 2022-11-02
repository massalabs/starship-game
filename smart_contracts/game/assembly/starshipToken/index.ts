/* eslint-disable require-jsdoc */
import {token} from '@massalabs/massa-as-sdk/assembly';

export function version(_: string): string {
  return token.version(_);
}

export function balanceOf(args: string): string {
  return token.balanceOf(args);
}

export function transfer(args: string): string {
  return token.transfer(args);
}

export function allowance(args: string): string {
  return token.allowance(args);
}

export function increaseAllowance(args: string): string {
  return token.increaseAllowance(args);
}

export function decreaseAllowance(args: string): string {
  return token.decreaseAllowance(args);
}

export function transferFrom(args: string): string {
  return token.transferFrom(args);
}

export function mint(args: string): string {
  return token.mint(args);
}

export function setTokenOwner(args: string): void {
  token.setTokenOwner(args);
}


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

export function symbol(_: string): string {
  // massa starship token
  return 'MST';
}

export function totalSupply(_: string): string {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  return '1000000';
}

export function decimals(_: string): string {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  return '2';
}
