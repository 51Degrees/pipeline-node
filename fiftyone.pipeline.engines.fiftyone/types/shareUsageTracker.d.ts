export = ShareUsageTracker;
declare const ShareUsageTracker_base: typeof import("fiftyone.pipeline.engines/types/tracker");
/**
 * The ShareUsageTracker is used by the ShareUsageElement to determine
 * whether to put evidence into a bundle to be sent to the 51Degrees
 * Share Usage service.
 **/
declare class ShareUsageTracker extends ShareUsageTracker_base {
    /**
     * Constructor for ShareUsageTracker
     *
     * @param {object} options options for share usage tracker
     * @param {number} options.size size of the share usage lru cache
     * @param {number} options.interval if identical evidence values are seen by the tracker within this interval (in milliseconds) it will be ignored by the tracker.
     **/
    constructor({ size, interval }?: {
        size: number;
        interval: number;
    }, ...args: any[]);
    cache: import("fiftyone.pipeline.engines/types/lru");
    interval: number;
    /**
     * Function to check if we should put the evidence in the cache
     *
     * @param {object} options options for match
     * @param {string} options.key key of piece of evidence
     * @param {*} options.value value of piece of evidence
     * @returns {boolean} whether put in cache
     **/
    match({ key, value }: {
        key: string;
        value: any;
    }): boolean;
    /**
     * Retreive entry from cache
     *
     * @param {object} cacheKey key value store of evidence to lookup
     * @returns {*} value stored in cache
     **/
    get(cacheKey: object): any;
    /**
     * Put entry in cache
     *
     * @param {object} cacheKey key value store of evidence
     * to place in cache
     **/
    put(cacheKey: object): void;
}
