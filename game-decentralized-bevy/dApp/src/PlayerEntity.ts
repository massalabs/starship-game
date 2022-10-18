/**
 * Blockchain Game Entity representation.
 *
 */

export interface IPlayerGameEntity {
  x: number;
  y: number;
  rot: number;
  w: number;
}

export interface IPlayerOnchainEntity extends IPlayerGameEntity {
  uuid: string;
  address: string;
  name: string;
  cbox: number;
}