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