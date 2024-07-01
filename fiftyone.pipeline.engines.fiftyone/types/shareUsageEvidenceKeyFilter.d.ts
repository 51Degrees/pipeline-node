export = ShareUsageEvidenceKeyFilter;
declare const ShareUsageEvidenceKeyFilter_base: typeof import("fiftyone.pipeline.core/types/evidenceKeyFilter");
/**
 * The ShareUsageEvidenceKeyFilter filters out all evidence
 * not needed by the 51Degrees ShareUsage service.
 * It allows for a specific whitelist of query strings,
 * a blacklist of headers and a specific cookie used for session information
 */
declare class ShareUsageEvidenceKeyFilter extends ShareUsageEvidenceKeyFilter_base {
    /**
     * Constructor for ShareUsageEvidenceKeyFilter
     *
     * @param {object} options options for filter
     * @param {string} options.cookie cookie used for session data
     * @param {Array} options.queryWhitelist whitelist of query string data
     * @param {Array} options.headerBlacklist blacklist of headers to remove
     */
    constructor({ cookie, queryWhitelist, headerBlacklist }: {
        cookie: string;
        queryWhitelist: any[];
        headerBlacklist: any[];
    }, ...args: any[]);
    includedQueryStringParams: any[];
    blockedHttpHeaders: any[];
    cookie: string;
    shareAll: boolean;
}
