/**
 * Blockchain Token Entity representation.
 *
 */

export interface ICollectedTokenOnchainEntity {
  uuid: string;
  playerUuid: string;
  value: number;
  time: number;
}