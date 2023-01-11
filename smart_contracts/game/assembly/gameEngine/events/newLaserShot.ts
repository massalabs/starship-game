/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class NewLaserShotEvent {
  laserUuid: string = '';
  shooterUuid: string = '';
  shooterAddress: string = '';
  time: f64 = 0.0;

  serializeToString(): string {
    const stringified = JSON.stringify<NewLaserShotEvent>(this);
    return stringified;
  }

  static parseFromString(data: string): NewLaserShotEvent {
    const parsed = JSON.parse<NewLaserShotEvent>(data);
    return parsed;
  }
}
