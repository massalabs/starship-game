export const wait = async (timeMilli: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
        clearTimeout(timeout);
        return resolve();
        }, timeMilli);
    });
};
    
export async function withTimeoutRejection(promise: Promise<any>, timeout: number):  Promise<any> {
const sleep = new Promise((resolve, reject) =>
    setTimeout(() => reject(new Error(`Timeout of ${timeout} has passed and promised did not resolve`)), timeout),
);
return Promise.race([promise, sleep]);
}

export class PollTimeout {
constructor(timeoutMil: number, playerAddress: string, callback: (playerAddress: string) => void) {
    this.clear = this.clear.bind(this);

    const that = this;
    this.isCleared = false;
    this.isCalled = false;
    this.timeoutHook = setTimeout(() => {
        if (!that.isCleared) {
            this.isCalled = true;
            callback(playerAddress);
        }
    }, timeoutMil);
}
private isCleared: boolean;
private isCalled: boolean;
private timeoutHook: NodeJS.Timer;

public clear(): void {
    if (!this.isCleared) {
        clearTimeout(this.timeoutHook);
        this.isCleared = true;
    }
}
}