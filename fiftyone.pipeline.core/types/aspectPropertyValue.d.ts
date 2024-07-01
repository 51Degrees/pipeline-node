export = AspectPropertyValue;
/**
 * An AspectPropertyValue is a wrapper for a value
 * It lets you check this wrapper has a value inside it
 * If not value is set, a specific no value message is returned
 */
declare class AspectPropertyValue {
    /**
     * Constructor for AspectPropertyValue
     *
     * @param {string} noValueMessage The message to show when no value is set
     * @param {*} value The value inside the wrapper
     */
    constructor(noValueMessage: string, value: any);
    noValueMessage: string;
    _value: any;
    hasValue: boolean;
    /**
     * Set the value of this instance.
     *
     * @param {*} value the value to set
     */
    set value(value: any);
    /**
     * Get the value of this instance.
     *
     * @returns {*} The value of the property
     * @throws Will throw error if 'hasValue' is false.
     */
    get value(): any;
}
