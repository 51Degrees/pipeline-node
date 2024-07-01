export = RequestClient;
declare class RequestClient {
    /**
     * Make a POST request to the specified url
     *
     * @param {string} url The url to send a request to
     * @param {object | null} data The data to send in the body of the request
     * @param {string | null} origin The value to use for the Origin header when
     * making the request
     * @returns {Promise} The resolve function will be passed the content
     * from the response and the reject function will be passed
     * an object with 3 properties:
     * headers = HTTP headers in the response
     * statusCode = HTTP status code of response
     * content = The content of the response or an error message
     */
    post(url: string, data: object | null, origin: string | null): Promise<any>;
    /**
     * Make a GET request to the specified url
     *
     * @param {string} url The url to send a request to
     * @param {string | null} origin The value to use for the Origin header when
     * making the request
     * @returns {Promise} The resolve function will be passed the content
     * from the response and the reject function will be passed
     * an object with 3 properties:
     * headers = HTTP headers in the response
     * statusCode = HTTP status code of response
     * content = The content of the response or an error message
     */
    get(url: string, origin: string | null): Promise<any>;
}
