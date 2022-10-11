export class GameEntityUpdate {
    public operation: string;
    public uuid: string;
    public address: string;
    public x: number;
    public y: number;
    public rot: number;
  
    constructor(operation: string, uuid: string, address: string, x: number, y: number, rot: number) {
      this.operation = operation;
      this.uuid = uuid;
      this.address = address;
      this.x = x;
      this.y = y;
      this.rot = rot;
    }
    // ------------------------------------
    set set_operation(operation: string) {
        this.operation = operation;
    }
    get get_operation() {
      return this.operation;
    }
    // ------------------------------------
    set set_uuid(uuid: string) {
        this.uuid = uuid;
    }
    get get_uuid() {
        return this.uuid;
    }
    // ------------------------------------
    set set_address(address: string) {
        this.address = address;
    }
    get get_address() {
        return this.address;
    }
    // ------------------------------------
    set set_x(x: number) {
        this.x = x;
    }
    get get_x() {
        return this.x;
    }
    // ------------------------------------
    set set_y(y: number) {
        this.y = y;
    }
    get get_y() {
        return this.y;
    }
    // ------------------------------------
    set set_rot(rot: number) {
        this.rot = rot;
    }
    get get_rot() {
        return this.rot;
    }
  }