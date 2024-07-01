export = FlowElement;
/**
 * @typedef {import('./flowData')} FlowData
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./evidenceKeyFilter')} EvidenceKeyFilter
 */
/**
 * A FlowElement is placed inside a pipeline
 * It receives Evidence via a FlowData object
 * It uses this to optionally create ElementData on the Flowdata
 * It has a unique dataKey which is used to extract data from the FlowData
 * Any errors in processing are caught in the FlowData's errors object
 **/
declare class FlowElement {
    /**
     * Constructor for flowElement class
     *
     * @param {object} options options for the FlowElement
     * @param {string} options.dataKey the dataKey the flowElement's
     * elementData will be stored under
     * @param {Function} options.processInternal callback to act on flowData
     * @param {object} options.properties list of properties including metadata
     * @param {EvidenceKeyFilter} options.evidenceKeyFilter an instance of
     * an EvidenceKeyFilter to filter evidence added to the Pipeline
     */
    constructor({ processInternal, dataKey, properties, evidenceKeyFilter }?: {
        dataKey: string;
        processInternal: Function;
        properties: object;
        evidenceKeyFilter: EvidenceKeyFilter;
    });
    dataKey: string;
    /**
     * Internal process function for a particular flowElement called
     * (via the flowElement.process() method) when flowData generated
     * by a pipleline is processsed. Overriden by instances of this base class
     *
     * @param {FlowData} flowData FlowData being processed
     * @returns {*} result of processing
     */
    processInternal(flowData: FlowData): any;
    properties: object;
    evidenceKeyFilter: EvidenceKeyFilterBase;
    /**
     * @type {Function[]}
     */
    registrationCallbacks: Function[];
    /**
     * @type {Pipeline[]}
     */
    pipelines: Pipeline[];
    /**
     * Internal function to be called when a FlowElement is added
     * to pipeline, runs through any registrationCallbacks on the FlowElement
     *
     * @param {Pipeline} pipeline the Pipeline the FlowElement is registered with
     * @param {FlowElement} flowElement The FlowElement the
     * registration callback is called on
     */
    onRegistration(pipeline: Pipeline, flowElement: FlowElement): void;
    /**
     * Function called to check if a FlowElement is ready
     * Used when there are asynchronous initialisation steps
     *
     * @returns {Promise} returns Promise
     * */
    ready(): Promise<any>;
    /**
     * To allow actions to take place before and after a
     * FlowElement's processInternal function runs, a process
     * wrapper is run first
     *
     * @param {FlowData} flowData FlowData being processed
     * @returns {Promise} FlowData after processing
     */
    process(flowData: FlowData): Promise<any>;
    /**
     * Call this function to update the properties meta database
     * in all the pipelines this flowElement has been added to
     *
     * @returns {Promise} notification of complete updates
     */
    updateProperties(): Promise<any>;
    /**
     * Get a flowElement's properties. By default returns a
     * promise wrapped version of the object's properties list
     * Can return standard value or promise
     *
     * @returns {object} dictionary of properties
     */
    getProperties(): object;
    /**
     * Internal log
     *
     * @param {string} type log type
     * @param {*} message message to log
     */
    _log(type: string, message: any): void;
}
declare namespace FlowElement {
    export { FlowData, Pipeline, EvidenceKeyFilter };
}
import EvidenceKeyFilterBase = require("./evidenceKeyFilter");
type Pipeline = import('./pipeline');
type FlowData = import('./flowData');
type EvidenceKeyFilter = import('./evidenceKeyFilter');
