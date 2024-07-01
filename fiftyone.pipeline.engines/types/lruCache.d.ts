export = LRUcache;
/**
 * An instance of DataKeyed cache using a least recently used (LRU) method
 **/
declare class LRUcache extends DataKeyedCache {
    /**
     * Constructor for LRUcache
     *
     * @param {object} options options for the lru cache
     * @param {number} options.size maximum entries in the cache
     */
    constructor({ size }: {
        size: number;
    }, ...args: any[]);
    cache: LRU;
    get(cacheKey: any): any;
    put(cacheKey: any, value: any): void;
}
import DataKeyedCache = require("./dataKeyedCache");
import LRU = require("./lru");
