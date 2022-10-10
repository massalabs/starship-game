/**
 * Blockchain Token Entity representation.
 *
 */

 export interface ITokenGameEntity {
  x: number;
  y: number;
}

export interface ITokenOnchainEntity extends ITokenGameEntity {
  uuid: string;
  cbox: number;
  value: number;
}