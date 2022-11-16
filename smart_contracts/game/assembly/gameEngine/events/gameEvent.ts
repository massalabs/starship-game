/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class GameEvent {
  data: string = '';
  time: f64 = 0;

  serializeToString(): string {
    const stringified = JSON.stringify<GameEvent>(this);
    return stringified;
  }

  static parseFromString(data: string): GameEvent {
    const parsed = JSON.parse<GameEvent>(data);
    return parsed;
  }
}
