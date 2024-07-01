export = AspectData;
declare const AspectData_base: typeof import("fiftyone.pipeline.core/types/elementData");
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('./missingPropertyService')} MissingPropertyService
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */
/**
 * Extension of elementData which allows for a missing property service
 * to be called when an accessed property isn't available.
 * Engines, an extension of flowElements also allow a restricted
 * property list so certain properties can be excluded
 **/
declare class AspectData extends AspectData_base {
    /**
     * Constructor for AspectData
     *
     * @param {object} options options object
     * @param {FlowElement} options.flowElement FlowElement the data is for
     * @param {MissingPropertyService} options.missingPropertyService
     * a missing property service to use when the property is in a
     * FlowElement's property list but not in the data
     */
    constructor({ flowElement, missingPropertyService }: {
        flowElement: FlowElement;
        missingPropertyService: MissingPropertyService;
    }, ...args: any[]);
    missingPropertyService: MissingPropertyServiceBase;
}
declare namespace AspectData {
    export { FlowElement, MissingPropertyService, FlowData };
}
import MissingPropertyServiceBase = require("./missingPropertyService");
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
type MissingPropertyService = import('./missingPropertyService');
type FlowData = import("fiftyone.pipeline.core/types/flowData");
