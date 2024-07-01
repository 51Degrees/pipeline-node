export = FlowData;
/**
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./elementData')} ElementData
 */
/**
 * FlowData is created by a specific pipeline
 * It collects evidence set by the user
 * It passes evidence to flowElements in the pipeline
 * These elements can return ElementData or populate an errors object
 */
declare class FlowData {
    /**
     * constructor for flowData created by a pipeline.
     * Called by a pipeline's createFlowData() method
     *
     * @param {Pipeline} pipeline the pipeline to add the FlowData to
     */
    constructor(pipeline: Pipeline);
    pipeline: import("./pipeline");
    evidence: Evidence;
    errors: {};
    stopped: boolean;
    data: {};
    /**
     * Get back an object that lists all evidence that will be
     * used by any flowElements in the flowData's parent pipeline
     *
     * @returns {object} Evidence that is requested by flowElements
     */
    getEvidenceDataKey(): object;
    /**
     * Stop a flowData from processing any further flowElements
     */
    stop(): void;
    /**
     * Set an error on the flowData (usually triggered by
     * something going wrong in a flowElement's process function)
     *
     * @param {*} error the error to throw
     * @param {FlowElement} flowElement the FlowElement the error is thrown on
     */
    setError(error: any, flowElement: FlowElement): void;
    /**
     * Processes the flowData (running the process methods on all connected)
     *
     * @returns {Promise} result of processing
     */
    process(): Promise<any>;
    /**
     * Add to the flowData object with a class derived from ElementData
     *
     * @param {ElementData} data instance of ElementData to
     * set for the FlowElement's datakey
     * @returns {FlowData} the FlowData object
     */
    setElementData(data: ElementData): FlowData;
    /**
     * Get ElementData by a flowElement's data key
     *
     * @param {string} flowElementDataKey the datakey of a FlowElement
     * @returns {ElementData} data from the FlowElement
     */
    get(flowElementDataKey: string): ElementData;
    /**
     * get ElementData by a FlowElement object
     *
     * @param {FlowElement} flowElement The FlowElement to fetch data for
     * @returns {ElementData} data from the FlowElement
     */
    getFromElement(flowElement: FlowElement): ElementData;
    /**
     * get an object ({key:value} store) of elementData
     * based on a metadata key and value, alternatively
     * pass in a filtering function to manually filter available propeties
     *
     * @param {string} metaKey a metakey such as "category"
     * @param {string|Function} metaValueorFuncton value or a filter
     * function which receives the value of the metaKey and returns a boolean
     * @returns {object} key value pair of matching properties and values
     */
    getWhere(metaKey: string, metaValueorFuncton: string | Function): object;
}
declare namespace FlowData {
    export { Pipeline, FlowElement, ElementData };
}
import Evidence = require("./evidence");
type Pipeline = import('./pipeline');
type FlowElement = import('./flowElement');
type ElementData = import('./elementData');
