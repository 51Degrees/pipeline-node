export = SetHeadersElement;
/**
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./flowData')} FlowData
 */
/**
 * Set response headers element class. This is used to get response
 * headers based on what the browser supports. For example, newer
 * Chrome browsers support the Accept-CH header.
 */
declare class SetHeadersElement extends FlowElement {
    constructor(...args: any[]);
    properties: {
        responseheadersdictionary: {
            name: string;
            type: string;
        };
    };
    headers: object;
    /**
     * Get the name of the header which the property relates to.
     *
     * @param {string} propertyName To get the header name from.
     * @returns {string} Header name.
     */
    getHeaderName(propertyName: string): string;
    /**
     * Construct the headers and their properties which can be set
     * by the service.
     * An example of the structure of the headers is:
     *   { 'Accept-CH':
     *     { name: 'Accept-CH',
     *       properties:
     *         [ 'device.SetHeaderBrowserAccept-CH',
     *           'device.SetHeaderPlatformAccept-CH',
     *           'device.SetHeaderHardwareAccept-CH' ] } }
     *
     * @param {Pipeline} pipeline The pipeline instance to get the properties from.
     * @returns {object} Collection of headers which can be set in the response.
     */
    constructHeaders(pipeline: Pipeline): object;
    /**
     * Add the response header dictionary to the FlowData.
     *
     * @param {FlowData} flowData the FlowData being processed
     */
    processInternal(flowData: FlowData): void;
    /**
     * Get response headers (e.g. Accept-CH)
     *
     * @param {FlowData} flowData A processed FlowData instance to get the response header values
     * from.
     * @returns {object} A dictionary of response header names with their values if they are not
     * null
     */
    getResponseHeaders(flowData: FlowData): object;
    /**
     * Try to get the value for the given element and property.
     * If the value cannot be found or is null/unknown, then undefined
     * is returned.
     *
     * @param {FlowData} flowData A processed FlowData instance to get the value from.
     * @param {string} elementKey Key for the element data to get the value from.
     * @param {string} propertyKey Name of the property to get the value for.
     * @returns {string | undefined} value string or undefined.
     */
    tryGetValue(flowData: FlowData, elementKey: string, propertyKey: string): string | undefined;
}
declare namespace SetHeadersElement {
    export { Pipeline, FlowData };
}
import FlowElement = require("./flowElement.js");
type Pipeline = import('./pipeline');
type FlowData = import('./flowData');
