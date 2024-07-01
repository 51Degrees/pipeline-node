export = SequenceElement;
/**
 * @typedef {import('./flowData')} FlowData
 */
/**
 * The SequenceElement stores session data regarding requests
 * for client side JavaScript from the JavaScript created by a
 * Pipeline's JavaScriptBuilder
 * If a Pipeline is constructed with the JavaScript elements enabled
 * this is added automatically along with the JavaScriptBuilder and JSONBundler.
 **/
declare class SequenceElement extends FlowElement {
    constructor(...args: any[]);
    evidenceKeyFilter: BasicListEvidenceKeyFilter;
    /**
     * Internal process function for the sequence element
     * Checks if there is a session id and sequence number set
     * if there is it increments the sequence number for that session
     * if not it initialises both
     *
     * @param {FlowData} flowData flowData with the evidence in it
     */
    processInternal(flowData: FlowData): void;
}
declare namespace SequenceElement {
    export { FlowData };
}
import FlowElement = require("./flowElement.js");
import BasicListEvidenceKeyFilter = require("./basicListEvidenceKeyFilter");
type FlowData = import('./flowData');
