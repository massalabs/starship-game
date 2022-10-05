/* eslint-disable max-len */
import {JSON} from 'json-as/assembly';

@json
class PlayerEntity {
  uuid: string;
  address: string;
  x: f32;
  y: f32;
  cbox: f32;
  tokensCollected: f32;

  serializeToString(): string {
    const stringified = JSON.stringify<PlayerEntity>(this);
    return stringified;
  }

  static parseFromString(data: string): PlayerEntity {
    const parsed = JSON.parse<PlayerEntity>(data);
    return parsed;
  }
}

describe('Doc tests', () => {
  it('should be simple to use', () => {
    const data: PlayerEntity = {
      uuid: 'uuid',
      address: 'AAAAAAAAAAAAAAAAA',
      x: 100.0,
      y: 200.0,
      cbox: 30.0,
      tokensCollected: 0.0,
    };

    
    const stringified = JSON.stringify<PlayerEntity>(data);
    log<string>(`Stringified: ${stringified}`);
    log<string>(`Stringified self: ${data.serializeToString()}`);

    const parsed = JSON.parse<PlayerEntity>(stringified);
    log<string>(`Parsed: ${JSON.stringify(parsed)}`);
    log<string>(`Parsed self: ${PlayerEntity.parseFromString(JSON.stringify(parsed)).address}`);
    

    const parsed2 = JSON.parse<PlayerEntity>('{"uuid":"uuid","address":"AAAAAAAAAAAAAAAAA","x":100.0,"y":200.0,"cbox":30.0,"tokensCollected":0.0}');
    log<string>(`Parsed2: ${JSON.stringify(parsed2)}`);
    log<string>(`Parsed3: ${parsed2.uuid}`);
  });
});
