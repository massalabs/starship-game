/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class CollectedEntity {
  uuid: string = '';
  time: f64 = 0.0;
  playerUuid: string = '';
  value: f32 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<CollectedEntity>(this);
    return stringified;
  }

  static parseFromString(data: string): CollectedEntity {
    const parsed = JSON.parse<CollectedEntity>(data);
    return parsed;
  }
}
