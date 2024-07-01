export = LRU;
declare class LRU {
    constructor(limit?: number);
    size: number;
    limit: number;
    head: any;
    tail: any;
    cache: {};
    __convertKey(key: any): any;
    write(key: any, value: any): void;
    read(key: any): any;
    ensureLimit(): void;
    remove(key: any): void;
    clear(): void;
    forEach(fn: any): void;
    [Symbol.iterator](): Generator<any, void, unknown>;
}
