export = CloudEngine;
declare const CloudEngine_base: typeof import("fiftyone.pipeline.engines/types/engine");
/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('./cloudRequestEngine')} CloudRequestEngine
 */
/**
 * This is a template for all 51Degrees cloud engines.
 * It requires the 51Degrees cloudRequestEngine to be placed in a
 *  pipeline before it. It takes that raw JSON response and
 * parses it to extract the device part.
 * It also uses this data to generate a list of properties and an evidence key filter
 **/
declare class CloudEngine extends CloudEngine_base {
    constructor(...args: any[]);
    /**
     * Handles the registration of the Cloud Engine in a pipeline.
     * This method is called when a pipeline is registered,
     * and it ensures that the CloudRequestEngine is present in the pipeline.
     *
     * @param {Pipeline} pipeline - The pipeline being registered.
     * @param {FlowElement} flowElement - The flow element associated with the Cloud Engine.
     */
    handlePipelineRegistration(pipeline: Pipeline, flowElement: FlowElement): void;
    /**
     * @type {CloudRequestEngine}
     */
    _cloudRequestEngine: CloudRequestEngine;
    _flowElement: import("fiftyone.pipeline.core/types/flowElement");
    /**
     * Updates the Cloud Engine when the CloudRequestEngine is ready.
     * This method fetches properties and evidence keys from the CloudRequestEngine,
     * updating the Cloud Engine accordingly.
     *
     * @param {Function} resolve - Callback to be called on successful completion.
     * @param {Function} reject - Callback to be called if there is an error.
     */
    updateEngineWhenCloudRequestEngineReady(resolve: Function, reject: Function): void;
    errors: any;
    /**
     * Internal process method for all cloud engines
     *
     * @param {FlowData} flowData FlowData to process
     * @returns {void}
     */
    processInternal(flowData: FlowData): void;
}
declare namespace CloudEngine {
    export { Pipeline, FlowElement, FlowData, CloudRequestEngine };
}
type CloudRequestEngine = import('./cloudRequestEngine');
type Pipeline = import("fiftyone.pipeline.core/types/pipeline");
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
