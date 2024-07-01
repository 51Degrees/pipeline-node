export = Pipeline;
/**
 * @typedef {import('./flowElement')} FlowElement
 */
/**
 * Pipeline holding a list of flowElements for processing, can create
 * flowData that will be passed through these, collecting elementData
 * Should be constructed through the PipelineBuilder class
 */
declare class Pipeline {
    /**
     * Constructor for Pipeline
     *
     * @param {FlowElement[]} flowElements list of FlowElements to
     * add to the Pipeline
     * @param {number} suppressProcessExceptions If true then pipeline
     * will suppress exceptions added to FlowData.
     * @param {EventEmitter} eventEmitter A logger for emitting messages
     */
    constructor(flowElements?: FlowElement[], suppressProcessExceptions?: number, eventEmitter?: EventEmitter);
    flowElementsChain: import("./flowElement")[];
    suppressProcessExceptions: number;
    eventEmitter: EventEmitter;
    /**
     * @type {object}
     */
    flowElements: object;
    /**
     * @type {object}
     */
    propertyDatabase: object;
    processMethod: (flowData: any) => any;
    /**
     * get a FlowElement by its dataKey
     *
     * @param {string} key the datakey of the FlowElement
     * @returns {FlowElement} the FlowElement for the datakey
     */
    getElement(key: string): FlowElement;
    /**
     * Method to attach listeners to the logger
     * Shorthand access to the enclosed event emitter
     *
     * @param {string} listener type of message to listen to
     * @param {Function} callback a callback to react to the log
     */
    on(listener: string, callback: Function): void;
    /**
     * Shorthand to trigger a message on the pipeline's eventEmitter
     *
     * @param {string} type type of message
     * @param {*} message message to store in the log
     */
    log(type: string, message: any): void;
    /**
     * Create a FlowData element from the pipeline
     *
     * @returns {FlowData} a FlowData object for the Pipeline
     * containing methods for adding evidence and processing via
     * the FlowElements in the Pipleine.
     */
    createFlowData(): FlowData;
    /**
     *  Update pipeline's property database for FlowElement
     *
     * @param {FlowElement} flowElement FlowElement to update
     * @returns {void}
     */
    updatePropertyDataBaseForElement(flowElement: FlowElement): void;
}
declare namespace Pipeline {
    export { FlowElement };
}
import EventEmitter = require("events");
import FlowData = require("./flowData");
type FlowElement = import('./flowElement');
