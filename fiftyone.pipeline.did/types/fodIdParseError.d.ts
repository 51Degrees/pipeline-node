export = FodIdParseError;
/**
 * A value that is not a 51Did, thrown by the surfaces that throw
 * (`FodId.fromBase64`, `FodId.fromByteArray`, `FodId.fromOwid` and the
 * constructor) when the OWID library refused the envelope. The status names
 * the reason in the same vocabulary the non-throwing surfaces report, so a
 * caller catching this can act on the reason without reading the message.
 * The two 51Did payload statuses are thrown as RangeError instead, as this
 * package has always thrown them, and that RangeError carries `status` too.
 */
declare class FodIdParseError extends Error {
    /**
     * Builds the error for a status.
     * @param {string} status one of `FodId.ParseStatus`
     */
    constructor(status: string);
    /** @type {string} one of `FodId.ParseStatus` */
    status: string;
}
