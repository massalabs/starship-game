export const ENTITY_TYPE = {
    LOCAL: "local",
    REMOTE: "remote"
};

export class GameEntityUpdate {
    public operation: string;
    public data?: string;
  
    constructor(operation: string, data: string) {
      this.operation = operation;
      this.data = data;
    }
    // ------------------------------------
    set set_operation(operation: string) {
        this.operation = operation;
    }
    get get_operation() {
      return this.operation;
    }
    // ------------------------------------
    set set_data(data: string) {
        this.data = data;
    }
    get get_data() {
        return this.data;
    }
  }