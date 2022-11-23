/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class PlayerTokenCollected {
  playerState: string = '';
  tokensState: string = '';

  serializeToString(): string {
    const stringified = JSON.stringify<PlayerTokenCollected>(this);
    return stringified;
  }

  static parseFromString(data: string): PlayerTokenCollected {
    const parsed = JSON.parse<PlayerTokenCollected>(data);
    return parsed;
  }
}
