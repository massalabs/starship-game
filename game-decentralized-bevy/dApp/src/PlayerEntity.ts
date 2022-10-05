/**
 * Blockchain Game Entity representation.
 *
 */

export interface IPlayerGameEntity {
  x: number;
  y: number;
  rot: number;
}

export interface IPlayerOnchainEntity extends IPlayerGameEntity {
  uuid: string;
  address: string;
  cbox: number;
  tokensCollected: number;
}