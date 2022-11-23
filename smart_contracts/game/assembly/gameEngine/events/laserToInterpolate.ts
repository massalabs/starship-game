/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class LaserToInterpolate {
  laserUuid: string = '';
  time: f64 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<LaserToInterpolate>(this);
    return stringified;
  }

  static parseFromString(data: string): LaserToInterpolate {
    const parsed = JSON.parse<LaserToInterpolate>(data);
    return parsed;
  }
}
