/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class SetPlayerLaserRequest {
  playerAddress: string = '';
  playerUuid: string = '';
  lasersData: string = ''; // format: "{player_uuid: string, uuid: string, x: number, y: number, rot: number, w: number}@{player_uuid: string, uuid: string, x: number, y: number, rot: number, w: number}"
  time: number = 0;

  serializeToString(): string {
    const stringified = JSON.stringify<SetPlayerLaserRequest>(this);
    return stringified;
  }

  static parseFromString(data: string): SetPlayerLaserRequest {
    const parsed = JSON.parse<SetPlayerLaserRequest>(data);
    return parsed;
  }
}
