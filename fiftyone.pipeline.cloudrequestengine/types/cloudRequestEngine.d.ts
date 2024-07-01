export = CloudRequestEngine;
declare const CloudRequestEngine_base: typeof import("fiftyone.pipeline.engines/types/engine");
/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').Evidence} Evidence
 */
declare class CloudRequestEngine extends CloudRequestEngine_base {
    /**
     * Constructor for CloudRequestEngine
     *
     * @param {object} options options object
     * @param {string} options.resourceKey resourcekey for cloud service
     * @param {string} options.licenseKey licensekey for cloud service
     * @param {string} options.baseURL url the cloud service is located at
     * if overriding default
     * @param {string} options.cloudRequestOrigin The value to set for the Origin
     * header when making requests to the cloud service.
     * This is used by the cloud service to check that the request is being
     * made from a origin matching those allowed by the resource key.
     * For more detail, see the 'Request Headers' section in the
     * <a href="https://cloud.51degrees.com/api-docs/index.html">cloud documentation</a>.
     * @param {RequestClient} options.requestClient Set predefined RequestClient.
     */
    constructor({ resourceKey, licenseKey, baseURL, cloudRequestOrigin, requestClient }: {
        resourceKey: string;
        licenseKey: string;
        baseURL: string;
        cloudRequestOrigin: string;
        requestClient: RequestClient;
    }, ...args: any[]);
    resourceKey: string;
    licenseKey: string;
    cloudRequestOrigin: string;
    requestClient: RequestClient;
    baseURL: string;
    evidenceKeys: any[];
    flowElementProperties: {};
    /**
     * Check if the keys and properties have been fetched.
     *
     * This computed property determines whether the keys of a 'flowElementProperties' object and the 'evidenceKeyFilter'
     * array both have elements, indicating that the necessary data has been fetched and is ready for use.
     *
     * @returns {boolean} True if the keys and properties are fetched and ready; otherwise, false.
     */
    get keysAndPropertiesFetched(): boolean;
    /**
     * Fetches evidence keys and properties data.
     *
     * This method asynchronously fetches evidence keys and properties required for the operation.
     * It uses Promises to handle data retrieval and provides callback functions for success and failure scenarios.
     *
     * @param {Function} resolveCallback - A callback function to be called when the data is successfully fetched.
     * It will receive the current instance as a parameter.
     *
     * @param {Function} rejectCallback - A callback function to be called when an error occurs during data retrieval.
     * It will receive the error information as a parameter.
     */
    fetchEvidenceKeysAndProperties(resolveCallback: Function, rejectCallback: Function): void;
    /**
     * Internal process for cloud engine
     * Returns raw JSON as a "cloud" property in "cloud"
     *
     * @param {FlowData} flowData flowData to process
     * @returns {Promise} data from cloud service
     */
    processInternal(flowData: FlowData): Promise<any>;
    /**
     * Typically, cloud will return errors as JSON.
     * However, transport level errors or other failures can result in
     * responses that are plain text. This function handles these cases.
     *
     * @param {string} responseBody the response data to process
     * @returns {Array} The error messages
     */
    getErrorMessages(responseBody: string): any[];
    /**
     * Used to handle errors from http requests
     *
     * @param {import('http').ServerResponse} response Responce to get errors from
     * @returns {Array<CloudRequestError>} Array of CloudRequestError from response
     */
    getErrorsFromResponse(response: import('http').ServerResponse): Array<CloudRequestError>;
    /**
     * Internal process to fetch all the properties available under a resourcekey
     *
     * @returns {Promise<object>} properties from the cloud server
     */
    fetchProperties(): Promise<object>;
    /**
     * Properties transform
     *
     * @param {object} properties properties to transform
     * @returns {object} transformed properties
     */
    propertiesTransform(properties: object): object;
    /**
     * Meta property transform
     *
     * @param {string} key key to check
     * @param {object} value properties to transform
     * @returns {object} transformed properties
     */
    metaPropertyTransform(key: string, value: object): object;
    /**
     * Internal function to get data from cloud service
     *
     * @param {FlowData} flowData
     * FlowData used to extract evidence and send to cloud service
     * for processing
     * @returns {Promise} result of processing
     */
    getData(flowData: FlowData): Promise<any>;
    /**
     * Internal function to get evidenceKeys used by cloud resourcekey
     *
     * @returns {Promise} evidence promise
     */
    getEvidenceKeys(): Promise<any>;
    /**
     * Generate the Content to send in the POST request. The evidence keys
     * e.g. 'query.' and 'header.' have an order of precedence. These are
     * added to the evidence in reverse order, if there is conflict then
     * the queryData value is overwritten.
     * 'query.' evidence should take precedence over all other evidence.
     * If there are evidence keys other than 'query.' that conflict then
     * this is unexpected so a warning will be logged.
     *
     * @param {FlowData} flowData FlowData to get evidence from
     * @returns {object} Evidence Dictionary
     */
    getContent(flowData: FlowData): object;
    /**
     * Add query data to the evidence.
     *
     * @param {FlowData} flowData FlowData for logging
     * @param {object} queryData The destination dictionary to add query data to.
     * @param {Evidence} allEvidence All evidence in the flow data. This is used to
     * report which evidence keys are conflicting.
     * @param {object} evidence Evidence to add to the query Data.
     */
    addQueryData(flowData: FlowData, queryData: object, allEvidence: Evidence, evidence: object): void;
    /**
     * Get evidence with specified prefix.
     *
     * @param {Evidence} evidence All evidence in the flow data.
     * @param {string} type Required evidence key prefix
     * @returns {Evidence} Selected evidence
     */
    getSelectedEvidence(evidence: Evidence, type: string): Evidence;
    /**
     * Check that the key of a KeyValuePair has the given prefix.
     *
     * @param {string} itemKey Key to check
     * @param {string} prefix The prefix to check for.
     * @returns {boolean} True if the key has the prefix.
     */
    hasKeyPrefix(itemKey: string, prefix: string): boolean;
}
declare namespace CloudRequestEngine {
    export { FlowData, Evidence };
}
import RequestClient = require("./requestClient");
import CloudRequestError = require("./cloudRequestError");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
type Evidence = import("fiftyone.pipeline.core/types/evidence");
