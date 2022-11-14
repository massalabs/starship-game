/**
 * Blockchain Game Entity representation.
 *
 */

export interface IPlayerLasersRequest {
  playerAddress: string;
  playerUuid: string;
  lasersData: string;
  time: number;
}

export interface IPlayerLaserData {
  player_uuid: string;
  uuid: string;
  x: number;
  y: number;
  rot: number;
  w: number;
}