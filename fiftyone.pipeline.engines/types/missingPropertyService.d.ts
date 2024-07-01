export = MissingPropertyService;
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */
/**
 * Base class for a missing property service that throws
 * an error if the property is not available for some reason
 **/
declare class MissingPropertyService {
    /**
     * Check is called if a property is requested that exists
     * in the FlowElement property list but is not available
     * in the AspectData returned by the FlowElement
     *
     * @param {string} key property key
     * @param {FlowElement} flowElement flowelement the data
     * was requested in
     */
    check(key: string, flowElement: FlowElement): void;
    /**
     * Return true if the supplied flow element is a CloudEngine, false if not.
     *
     * @param {FlowElement} flowElement The flow element to check
     * @returns {boolean} Is CloudEngine
     */
    _isCloudEngine(flowElement: FlowElement): boolean;
}
declare namespace MissingPropertyService {
    export { FlowElement };
}
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
