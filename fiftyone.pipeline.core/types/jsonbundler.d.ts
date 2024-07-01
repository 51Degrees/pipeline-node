export = JSONBundlerElement;
/**
 * The JSONBundler aggregates all properties from FlowElements
 * into a JSON object
 * It is used for retrieving via an endpoint from the client
 * side via the JavaScriptBuilder and also used inside the
 * JavaScriptBuilder itself to pass properties to the client side.
 * Both this and the JavaScriptBuilder element are automatically
 * added to a pipeline unless specifically ommited in the PipelineBuilder
 */
declare class JSONBundlerElement extends FlowElement {
    constructor(...args: any[]);
    evidenceKeyFilter: BasicListEvidenceKeyFilter;
    propertyCache: {};
    /**
     * The JSON Builder extracts all properties and serializes them into JSON
     *
     * @param {FlowData} flowData the FlowData being processed
     */
    processInternal(flowData: FlowData): void;
}
declare namespace JSONBundlerElement {
    export { FlowData };
}
import FlowElement = require("./flowElement.js");
import BasicListEvidenceKeyFilter = require("./basicListEvidenceKeyFilter.js");
type FlowData = import('./flowData');
