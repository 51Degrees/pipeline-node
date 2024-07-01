export = ElementData;
/**
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./flowData')} FlowData
 */
/**
 * Stores information created by a flowElement based on flowData.
 * Stored in flowData
 */
declare class ElementData {
    /**
     * Constructor for elementData
     *
     * @param {object} options the options object
     * @param {FlowElement} options.flowElement the FlowElement this data
     * is part of
     */
    constructor({ flowElement }: {
        flowElement: FlowElement;
    });
    flowElement: import("./flowElement");
    /**
     * Internal get method for elementData to retrieve an element from it
     * called via the elementData's get method
     * This method is overriden by classes inheriting from elementData
     *
     * @param {string} key the key to retrieve a property value for
     */
    getInternal(key: string): void;
    /**
     * A wrapper that performs actions before passing on processing
     * (or skipping) the getInternal method
     *
     * @param {string} key the key to retrieve a property value for
     * @returns {FlowData} value
     */
    get(key: string): FlowData;
    /**
     * Return string value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {string} value
     */
    getAsString(key: string): string;
    /**
     * Return float value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {number} float value
     */
    getAsFloat(key: string): number;
    /**
     * Return int value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {number} int value
     */
    getAsInteger(key: string): number;
}
declare namespace ElementData {
    export { FlowElement, FlowData };
}
type FlowElement = import('./flowElement');
type FlowData = import('./flowData');
