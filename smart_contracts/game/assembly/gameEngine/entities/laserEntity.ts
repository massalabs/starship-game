/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class LaserEntity {
  uuid: string = '';
  x: f32 = 0.0;
  y: f32 = 0.0;
  xx: f32 = 0.0;
  yy: f32 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<LaserEntity>(this);
    return stringified;
  }

  static parseFromString(data: string): LaserEntity {
    const parsed = JSON.parse<LaserEntity>(data);
    return parsed;
  }
}
