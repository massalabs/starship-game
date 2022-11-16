/* eslint-disable max-len */
import {JSON} from 'json-as/assembly';
import {Rectangle, _isIntersection} from '../utils/rectangle';

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

describe('Ser/deser tests', () => {
  it('Serialize and deserialize from string', () => {
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

describe('Collisions', () => {
  it('Check for collisions between one rectangle intersecting another one', () => {
    const rect1: Rectangle = new Rectangle(
        20.0, // left
        70.0, // right
        100.0, // top
        50.0, // bottom
    );
    log<string>(`Rectangle1: ${JSON.stringify(rect1)}`);

    const rectangle2InsideRect1: Rectangle = new Rectangle(
        10.0, // left
        30.0, // right
        80.0, // top
        10.0, // bottom
    );
    log<string>(`Rectangle2: ${JSON.stringify(rectangle2InsideRect1)}`);

    assert<bool>(_isIntersection(rect1, rectangle2InsideRect1), 'Expect intersection');
    assert<bool>(_isIntersection(rectangle2InsideRect1, rect1), 'Expect intersection');
  });

  it('Check for collisions between one rectangle completely enclosed by another one', () => {
    const rect1: Rectangle = new Rectangle(
        20.0, // left
        70.0, // right
        100.0, // top
        50.0, // bottom
    );
    log<string>(`Rectangle1: ${JSON.stringify(rect1)}`);

    const rectangle2InsideRect1: Rectangle = new Rectangle(
        60.0, // left
        70.0, // right
        80.0, // top
        50.0, // bottom
    );
    log<string>(`Rectangle2: ${JSON.stringify(rectangle2InsideRect1)}`);

    assert<bool>(_isIntersection(rect1, rectangle2InsideRect1), 'Expect intersection');
    assert<bool>(_isIntersection(rectangle2InsideRect1, rect1), 'Expect intersection');
  });


  it('Check for no collision', () => {
    const rect1: Rectangle = new Rectangle(
        20.0, // left
        70.0, // right
        100.0, // top
        50.0, // bottom
    );
    log<string>(`Rectangle1: ${JSON.stringify(rect1)}`);

    const rectangle2: Rectangle = new Rectangle(
        60.0, // left
        70.0, // right
        40.0, // top
        0.0, // bottom
    );
    log<string>(`Rectangle2: ${JSON.stringify(rectangle2)}`);

    assert<bool>(!_isIntersection(rect1, rectangle2), 'Expect intersection');
    assert<bool>(!_isIntersection(rectangle2, rect1), 'Expect intersection');
  });
});
