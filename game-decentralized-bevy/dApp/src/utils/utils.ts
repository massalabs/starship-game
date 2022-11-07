
export interface IParsedEventData<T> {
    data: T|null;
    isError: boolean;
}

export function parseJson<T>(json: string|null|undefined): IParsedEventData<T> {
    if (!json) {
        return {
            data: null,
            isError: true,
        } as IParsedEventData<T>;
    }
    let parsedData: T|undefined = undefined;
    try {
        parsedData = JSON.parse(json);
    } catch (ex) {
        return {
            data: null,
            isError: true,
        } as IParsedEventData<T>;
    }
    return {
        data: parsedData as T,
        isError: false,
    } as IParsedEventData<T>;
}