/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import {JSON} from 'json-as/assembly';

@json
export class RegisterPlayerRequest {
  address: string = '';
  name: string = '';

  serializeToString(): string {
    const stringified = JSON.stringify<RegisterPlayerRequest>(this);
    return stringified;
  }

  static parseFromString(data: string): RegisterPlayerRequest {
    const parsed = JSON.parse<RegisterPlayerRequest>(data);
    return parsed;
  }
}
