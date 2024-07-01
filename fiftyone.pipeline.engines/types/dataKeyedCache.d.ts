export = DataKeyedCache;
/**
 * A simple cache getter that takes a cache key and
 * returns an element if it is found in the cache
 */
declare class DataKeyedCache {
    /**
     * Get data out of the cache
     *
     * @param {*} cachekey key to lookup in the cache
     */
    get(cachekey: any): void;
    /**
     *  Add an element to the cache
     *
     * @param {*} cachekey key for the cache entry
     * @param {any} value value for the cache entry
     */
    put(cachekey: any, value: any): void;
}
