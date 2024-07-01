/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2023 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

class RequestClient {
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
  post (url, data, origin) {
    let httpModule;

    if (url.indexOf('https') !== -1) {
      httpModule = require('https');
    } else {
      httpModule = require('http');
    }
    let requestData = '';
    if (data) {
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i++) {
        requestData += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(data[keys[i]]);
        if (i < (keys.length - 1)) requestData += '&';
      }
    }

    return new Promise(function (resolve, reject) {
      const httpOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };
      if (origin) {
        httpOptions.headers.Origin = origin;
      }
      if (requestData) {
        httpOptions.headers['Content-Length'] = requestData.length;
      }

      const req = httpModule.request(url, httpOptions, function (resp) {
        let data = '';
        const result = {
          headers: resp ? resp.headers : undefined,
          statusCode: resp ? resp.statusCode : undefined
        };

        resp.on('data', (chunk) => {
          data += chunk;
        });

        resp.on('end', () => {
          result.content = data;
          // If response from cloud is not 2** / 3**, reject with error
          if (resp.statusCode > 399) {
            reject(result);
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', (err) => {
        reject({ content: err.message }); // eslint-disable-line
      });

      req.write(requestData);
      req.end();
    });
  }

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
  get (url, origin) {
    let httpModule;

    if (url.indexOf('https') !== -1) {
      httpModule = require('https');
    } else {
      httpModule = require('http');
    }

    return new Promise(function (resolve, reject) {
      const httpOptions = {
        method: 'GET'
      };
      if (origin) {
        httpOptions.headers = {
          Origin: origin
        };
      }

      httpModule.get(url, httpOptions, function (resp) {
        let data = '';
        const result = {
          headers: resp ? resp.headers : undefined,
          statusCode: resp ? resp.statusCode : undefined
        };

        resp.on('data', (chunk) => {
          data += chunk;
        });

        resp.on('end', () => {
          result.content = data;
          // If response from cloud is not 2** / 3**, reject with error
          if (resp.statusCode > 399) {
            reject(result);
          } else {
            resolve(data);
          }
        });
      }).on('error', (err) => {
        reject({ content: err.message }); // eslint-disable-line
      });
    });
  }
}

module.exports = RequestClient;
