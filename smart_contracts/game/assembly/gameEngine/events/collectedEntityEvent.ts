/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class CollectedEntityEvent {
  uuid: string = '';
  time: f64 = 0.0;
  playerUuid: string = '';
  value: f32 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<CollectedEntityEvent>(this);
    return stringified;
  }

  static parseFromString(data: string): CollectedEntityEvent {
    const parsed = JSON.parse<CollectedEntityEvent>(data);
    return parsed;
  }
}
