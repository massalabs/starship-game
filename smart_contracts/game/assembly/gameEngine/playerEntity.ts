/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class PlayerEntity {
  uuid: string = '';
  address: string = '';
  x: f32 = 0.0;
  y: f32 = 0.0;
  cbox: f32 = 0.0;
  tokensCollected: u64 = 0;

  serializeToString(): string {
    const stringified = JSON.stringify<PlayerEntity>(this);
    return stringified;
  }

  static parseFromString(data: string): PlayerEntity {
    const parsed = JSON.parse<PlayerEntity>(data);
    return parsed;
  }
}
