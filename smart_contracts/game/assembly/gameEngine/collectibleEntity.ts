/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class CollectibleEntity {
  uuid: string = '';
  x: f32 = 0.0;
  y: f32 = 0.0;
  cbox: f32 = 0.0;
  value: u64 = 0;

  serializeToString(): string {
    const stringified = JSON.stringify<CollectibleEntity>(this);
    return stringified;
  }

  static parseFromString(data: string): CollectibleEntity {
    const parsed = JSON.parse<CollectibleEntity>(data);
    return parsed;
  }
}
