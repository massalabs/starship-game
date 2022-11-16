/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable require-jsdoc */
import {token} from '@massalabs/massa-as-sdk/assembly';

export function balanceOf(args: string): string {
  const balance = token.balanceOf(args);
  return balance;
}

export function transfer(args: string): string {
  return token.transfer(args);
}

export function allowance(args: string): string {
  const allowance = token.allowance(args);
  return allowance;
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
  const name = 'Massa Example token';
  return name;
}

export function symbol(_: string): string {
  // massa starship token
  const symbol = 'MST';
  return symbol;
}

export function totalSupply(_: string): string {
  const totalSupply = '1000000';
  return totalSupply;
}

export function decimals(_: string): string {
  const decimals = '2';
  return decimals;
}

export function version(_: string): string {
  const version = token.version(_);
  return version;
}
