export = Tracker;
/**
 * A tracker is an instance of datakeyed cache which,
 * if a result is found in the cache, calls an additional
 * boolean match method
 */
declare class Tracker extends DataKeyedCache {
    /**
     * The track method calls the dataKeyedCache get method,
     * if it receives a result it sends it onto a match function
     *
     * @param {*} key cache key to run through tracker
     * @returns {boolean} result of tracking
     */
    track(key: any): boolean;
    /**
     * If object is found in cache, the match function is called
     *
     * @param {string} key key of piece of evidence
     * @param {*} value value of piece of evidence
     * @returns {boolean} whether put in cache
     */
    match(key: string, value: any): boolean;
}
import DataKeyedCache = require("./dataKeyedCache");
