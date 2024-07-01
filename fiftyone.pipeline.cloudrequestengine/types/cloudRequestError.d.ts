export = CloudRequestError;
declare class CloudRequestError extends Error {
    /**
     * Constructor for Cloud Request Error
     *
     * @param {string} message error message
     * @param {*} responseHeaders response headers
     * @param {number} httpStatusCode http status code
     */
    constructor(message: string, responseHeaders: any, httpStatusCode: number);
    errorMessage: string;
    responseHeaders: any;
    httpStatusCode: number;
}
