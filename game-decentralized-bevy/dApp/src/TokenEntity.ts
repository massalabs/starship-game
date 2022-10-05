/**
 * Game Entity representation.
 *
 */
export class Entity {
  private _uuid: string;
  private _playerAddress: string;
  private _x: number;
  private _y: number;
  private _bbMargin: number;

  /**
   * Sets allowance arguments;
   *
   * @param {string} uuid - Player uuid.
   * @param {Address} playerAddress - Player address.
   * @param {number} x - X- coordinate.
   * @param {number} y - Y- coordinate.
   * @param {number} bbMargin - BB Margin size (assumed to be equal on all sides)
   */
  constructor(
      uuid: string,
      playerAddress: string,
      x: number,
      y: number,
      bbMargin: number
  ) {
    this._uuid = uuid;
    this._playerAddress = playerAddress;
    this._x = x;
    this._y = y;
    this._bbMargin = bbMargin;
  }


  /**
   * Returns the version of the smart contract.
   * This versioning is following the best practices defined in https://semver.org/.
   *
   * @return {string}
   */
  toString(): string {
    return [
      this._uuid,
      this._playerAddress,
      this._x.toString(),
      this._y.toString(),
      this._bbMargin.toString(),
    ].join(',');
  }

  /**
   * Returns the version of the smart contract.
   * This versioning is following the best practices defined in https://semver.org/.
   * @param {string} args - Player address.
   * @return {Entity}
   */
  static fromString(args: string): Entity {
    const parts = args.split(',');
    const playerUuid: string = parts[0];
    const playerAddress: string = parts[1];
    const x = parseInt(parts[2], 10);
    const y = parseInt(parts[3], 10);
    const bbMargin = parseInt(parts[4], 10);
    const entity = new Entity(playerUuid, playerAddress, x, y, bbMargin);
    return entity;
  }

  /**
   * Returns the approval amount.
   *
   * @return {Amount} Amount.
   */
  playerAddress(): string {
    return this._playerAddress;
  }

  /**
   * Returns the approval amount.
   *
   * @param {number} x - Player address.
   */
  setX(x: number): void {
    this._x = x;
  }

  /**
   * Returns the approval amount.
   *
   * @param {number} y - Player address.
   */
  setY(y: number): void {
    this._y = y;
  }

  /**
   * Returns the approval owner.
   *
   * @return {number} Player x coordinate.
   */
  getX(): number {
    return this._x;
  }

  /**
   * Returns the approval owner.
   *
   * @return {number} Player y coordinate.
   */
  getY(): number {
    return this._y;
  }

  /**
   * Returns the bounding box margin
   *
   * @return {number} Player bounding box margin.
   */
  getBboxMargin(): number {
    return this._bbMargin;
  }

  /**
   * Returns the player uuid
   *
   * @return {string} Player uuid.
   */
  getEntityUuid(): string {
    return this._uuid;
  }
}
