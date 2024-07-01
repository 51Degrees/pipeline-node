/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
export = ShareUsage;
declare const ShareUsage_base: typeof import("fiftyone.pipeline.engines/types/engine");
/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */
/**
 * The ShareUsage element sends usage data to 51Degrees in zipped batches
 */
declare class ShareUsage extends ShareUsage_base {
    /**
     * Constructor for ShareUsage engine
     *
     * @param {object} options settings object for share usage.
     * @param {number} options.interval If exactly the same evidence values
     * are seen multiple times within this time limit (in milliseconds) then
     * they will only be shared once.
     * @param {number} options.requestedPackageSize The usage element
     * will group data into single requests before sending it.
     * This setting controls the minimum number of entries before
     * data is sent.
     * If you are sharing large amounts of data, increasing this value
     * is recommended in order to reduce the overhead of sending HTTP
     * messages.
     * For example, the 51Degrees cloud service uses a value of 2500.
     * @param {string} options.cookie if a cookie is being used to identify
     * user sessions, it can be specified here in order to reduce the
     * sharing of duplicated data.
     * @param {Array} options.queryWhitelist By default query string
     * and HTTP form parameters are not shared unless prefixed with '51D_'.
     * If you need to share query string parameters, a list can be
     * specified here.
     * @param {Array} options.headerBlacklist By default, all HTTP headers
     * (except a few, such as Cookies) are shared. Individual headers can
     * be excluded from sharing by adding them to this list.
     * @param {number} options.sharePercentage approximate proportion of
     * requests to be shared. 1 = 100%, 0.5 = 50%, etc..
     * @param {string} options.endpoint The target destination for usage
     * sharing data. The default is https://devices-v4.51degrees.com/new.ashx.
     */
    constructor({ interval, requestedPackageSize, cookie, queryWhitelist, headerBlacklist, sharePercentage, endpoint }?: {
        interval: number;
        requestedPackageSize: number;
        cookie: string;
        queryWhitelist: any[];
        headerBlacklist: any[];
        sharePercentage: number;
        endpoint: string;
    }, ...args: any[]);
    trackingCookie: string;
    evidenceKeyFilter: ShareUsageEvidenceKeyFilter;
    tracker: ShareUsageTracker;
    requestedPackageSize: number;
    sharePercentage: number;
    shareData: any[];
    endpoint: url.URL;
    http: typeof import("http") | typeof import("https");
    /**
     * Internal process method which uses the ShareUsageTracker
     * to determine whether to add usage data to a batch and adds it if necessary.
     *
     * @param {FlowData} flowData flowData to process
     */
    processInternal(flowData: FlowData): void;
    /**
     * Creates a ShareUsageData instance populated from the evidence
     * within the flow data provided.
     *
     * @param {FlowData} flowData the flow data containing the evidence to use
     * @returns {ShareUsageData} New ShareUsageData instance, populated from the evidence
     * provided
     */
    getDataFromEvidence(flowData: FlowData): ShareUsageData;
    getConstantXml(): string;
    constantXml: string;
    /**
     * Internal method which adds to the share usage bundle (generating XML)
     *
     * @param {object} data key value store of current
     * evidence in FlowData (filtered by the ShareUsageEvidenceKeyFilter)
     */
    addToShareUsage(data: object): void;
    /**
     * Internal method to send the share usage bundle to the 51Degrees servers
     */
    sendShareUsage(): void;
    /**
     * Return a list of FlowElements in the pipeline.
     * If the list is null then populate from the pipeline.
     * If there are multiple or no pipelines then log an error.
     *
     * @returns {Array<FlowElement>} list of flow elements
     */
    getFlowElements(): Array<FlowElement>;
    /**
     * @type {Array<FlowElement>}
     */
    flowElements: Array<FlowElement>;
}
declare namespace ShareUsage {
    export { FlowData, FlowElement };
}
import ShareUsageEvidenceKeyFilter = require("./shareUsageEvidenceKeyFilter");
import ShareUsageTracker = require("./shareUsageTracker");
import url = require("url");
/**
 * Internal class that is used to store details of data in memory
 * prior to it being sent to 51Degrees.
 */
declare class ShareUsageData {
    evidenceData: {};
    sessionId: string;
    clientIp: string;
    sequence: string;
    /**
     * Try to add data to shared usage
     *
     * @param {string} key key to add by
     * @param {*} value value to add
     */
    tryAddToData(key: string, value: any): void;
}
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
