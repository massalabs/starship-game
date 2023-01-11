/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class LaserDestroyedEvent {
  laserUuid: string = '';
  shooterUuid: string = '';
  shooterAddress: string = '';
  time: f64 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<LaserDestroyedEvent>(this);
    return stringified;
  }

  static parseFromString(data: string): LaserDestroyedEvent {
    const parsed = JSON.parse<LaserDestroyedEvent>(data);
    return parsed;
  }
}
