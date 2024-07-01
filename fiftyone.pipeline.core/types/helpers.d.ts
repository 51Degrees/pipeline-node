export = Helpers;
/**
 * @typedef {import('./flowData')} FlowData
 */
declare class Helpers {
    /**
     * Set response headers in the response object (e.g. Accept-CH)
     *
     * @param {import('http').ServerResponse} response The response to set the headers in.
     * @param {FlowData} flowData A processed FlowData instance to get the response header values
     * from.
     */
    static setResponseHeaders(response: import('http').ServerResponse, flowData: FlowData): void;
}
declare namespace Helpers {
    export { FlowData };
}
type FlowData = import('./flowData');
