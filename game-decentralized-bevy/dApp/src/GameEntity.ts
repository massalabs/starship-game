export const ENTITY_TYPE = {
    LOCAL: "local",
    REMOTE: "remote"
};

export class GameEntityUpdate {
    public operation: string;
    public uuid: string;
    public address: string;
    public name: string;
    public x: number;
    public y: number;
    public rot: number;
    public w: number;
    public type: string;
  
    constructor(operation: string, uuid: string, address: string, name: string, x: number, y: number, rot: number, w: number, type: string) {
      this.operation = operation;
      this.uuid = uuid;
      this.address = address;
      this.name = name;
      this.x = x;
      this.y = y;
      this.rot = rot;
      this.w = w;
      this.type = type;
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
    set set_name(name: string) {
        this.name = name;
    }
    get get_name() {
        return this.name;
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
    // ------------------------------------
    set set_w(w: number) {
        this.w = w;
    }
    get get_w() {
        return this.w;
    }
  }