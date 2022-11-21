/**
 * Blockchain Game Laser representation.
 *
 */

export interface IPlayerLasersRequest extends IPlayerLaserData {
  playerAddress: string;
  time: number;
}

export interface IPlayerLaserData {
  playerUuid: string;
  uuid: string;
  x: number;
  y: number;
  rot: number;
  w: number;
}