export = AspectDataDictionary;
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('./missingPropertyService')} MissingPropertyService
 */
/**
 * Extension of elementDataDictionary which stores a
 * {key,value} dictionary of elements like elementDataDictionary
 * but with the additional aspectData extensions
 */
declare class AspectDataDictionary extends AspectData {
    /**
     * Constructor for AspectDataDictionary
     *
     * @param {object} options options object
     * @param {FlowElement} options.flowElement FlowElement the data is for
     * @param {MissingPropertyService} options.missingPropertyService
     a missing property service to use when the property is in a
     * FlowElement's property list but not in the data
     * @param {object} options.contents the data to store
     */
    constructor({ flowElement, contents, missingPropertyService }: {
        flowElement: FlowElement;
        missingPropertyService: MissingPropertyService;
        contents: object;
    }, ...args: any[]);
    contents: object;
    /**
     * getInternal retrieves a value from the dictionary
     *
     * @param {string} key property key
     * @returns {*} property value
     */
    getInternal(key: string): any;
    [Symbol.iterator](): Generator<string, void, unknown>;
}
declare namespace AspectDataDictionary {
    export { FlowElement, MissingPropertyService };
}
import AspectData = require("./aspectData");
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
type MissingPropertyService = import('./missingPropertyService');
