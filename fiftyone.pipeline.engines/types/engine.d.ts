export = Engine;
declare const Engine_base: typeof import("fiftyone.pipeline.core/types/flowElement");
/**
 * @typedef {import('./dataFile')} DataFile
 * @typedef {import('./dataKeyedCache')} DataKeyedCache
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */
/**
 * An Engine is an extension of a FlowElement which adds
 * options such as restricting to a subset of properties
 * and a cache and the ability to load property data
 * from a datafile of the DataFile class
 */
declare class Engine extends Engine_base {
    /**
     * Constructor for an Engine
     *
     * @param {object} options options for the engine
     * @param {DataFile} options.dataFile an optional datafile
     * to add to the engine
     * @param {DataKeyedCache} options.cache instance of a DataKeyedCache
     * @param {Array} options.restrictedProperties specific list
     * of properties to fetch elementData for
     */
    constructor({ cache, restrictedProperties, dataFile }?: {
        dataFile: DataFile;
        cache: DataKeyedCache;
        restrictedProperties: any[];
    }, ...args: any[]);
    cache: import("./dataKeyedCache");
    restrictedProperties: any[];
    /**
     * Checks cache and returns cached result if found.
     *
     * @param {FlowData} flowData checks if a FlowData's evidence
     * is already in the cache and processing can be bypassed
     * @returns {boolean} whether in cache
     */
    inCache(flowData: FlowData): boolean;
    /**
     * An engine's process function checks cache for an item
     * (calling inCache)
     * If found it returns the cached object
     * If not found it runs the standard processInternal function
     * and adds it to the cache (if a cache is present)
     *
     * @param {FlowData} flowData FlowData to process
     * @returns {Promise<true|void>} result of processing
     */
    process(flowData: FlowData): Promise<true | void>;
    /**
     * Callback which runs when an attached DataFile is updated
     * Needs to be overriden by a specific engine to do anything
     *
     * @returns {void}
     */
    refresh(): void;
    /**
     * Function to attach a DataFile to the engine and
     * register it with a DataFileUpdateService if needed
     *
     * @param {DataFile} dataFile the datafile to register
     */
    registerDataFile(dataFile: DataFile): void;
}
declare namespace Engine {
    export { DataFile, DataKeyedCache, FlowData };
}
type DataFile = import("./dataFile");
type DataKeyedCache = import("./dataKeyedCache");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
