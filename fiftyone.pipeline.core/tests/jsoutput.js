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

fiftyoneDegreesManager = function () { // eslint-disable-line
  'use-strict';
  const json = { nullValueReasons: { 'testengine.four': 'This property is not available' }, javascriptProperties: ['testengine.three'], testengine: { one: 1, two: 2, three: "console.log('ok')", four: null } };

  // Log any errors returned in the JSON object.
  if (json.error !== undefined) {
    console.log(json.error);
  }
  // Set to true when the JSON object is complete.
  const completed = false;

  // changeFuncs is an array of functions. When onChange is called and passed
  // a function, the function is registered and is called when processing is
  // complete.
  const changeFuncs = [];

  // Counter is used to count how many pieces of callbacks are expected. Every
  // time the completedCallback method is called, the counter is decremented
  // by 1. The counter's initial value is 1 as the method is always called
  // once to continue execution.
  let callbackCounter = 1;

  // startsWith polyfill.
  const startsWith = function (source, searchValue) {
    return source.lastIndexOf(searchValue, 0) === 0;
  };

  // Get cookies with the '51D_' prefix that have been added to the request
  // and return the data as key value pairs. This method is needed to extract
  // cookie values for inclusion in the GET or POST request for situations
  // where CORS will prevent cookies being sent to third parties.
  const getFodCookies = function () {
    const keyValuePairs = document.cookie.split(/; */);
    const fodCookies = [];
    for (let i = 0; i < keyValuePairs.length; i++) {
      const name = keyValuePairs[i].substring(0, keyValuePairs[i].indexOf('='));
      if (startsWith(name, '51D_')) {
        const value = keyValuePairs[i].substring(keyValuePairs[i].indexOf('=') + 1);
        fodCookies[name] = value;
      }
    }
    return fodCookies;
  };

  // Extract key value pairs from the '51D_' prefixed cookies and concatenates
  // them to form a query string for the subsequent json refresh.
  const getParametersFromCookies = function () { // eslint-disable-line
    const fodCookies = getFodCookies();
    const keyValuePairs = [];
    for (const key in fodCookies) {
      if (fodCookies.hasOwnProperty(key)) {
        keyValuePairs.push(key + '=' + fodCookies[key]);
      }
    }
    return keyValuePairs;
  };

  /**
   * Delete a cookie.
   *
   * @param {string} name Name of a cookie
   */
  function deleteCookie (name) { // eslint-disable-line
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  // Fetch a value safely from the json object. If a key somewhere down the
  // '.' separated hierarchy of keys is not present then 'undefined' is
  // returned rather than letting an exception occur.
  const getFromJson = function (key) {
    let result;
    if (typeof (key) === 'string') {
      let functions = json;
      const segments = key.split('.');
      let i = 0;
      while (functions !== undefined && i < segments.length) {
        functions = functions[segments[i++]];
      }
      if (typeof (functions) === 'string') {
        result = functions;
      }
    }
    return result;
  };

  // Executed at the end of the processJSproperties method or for each piece
  // of JavaScript which has 51D code injected. When there are 0 pieces of
  // JavaScript left to process then reload the JSON object.
  const completedCallback = function (resolve, reject) {
    callbackCounter--;
    if (callbackCounter === 0) {
      resolve();
    } else if (callbackCounter < 0) {
      reject('Too many callbacks.');
    }
  };

  // Executes any Javascript contained in the json data. Sets the processedJs
  // flag to true when there is no further Javascript to be processed.
  const processJSproperties = function (resolve, reject) {
    if (json.javascriptProperties !== undefined) {
      if (json.javascriptProperties.length > 0) {
        // Execute each of the Javascript property code snippets using the
        // index of the value to access the value to avoid problems with
        // JavaScript returning erroneous values.
        for (let index = 0;
          index < json.javascriptProperties.length;
          index++) {
          const name = json.javascriptProperties[index];

          // Create new function bound to this instance and execute it.
          // This is needed to ensure the scope of the function is
          // associated with this instance if any members are altered or
          // added. Avoids global scoped variables.
          let body = getFromJson(name);

          if (body !== undefined) {
            let func;
            const searchString = '// 51D replace this comment with callback function.';

            if (body.indexOf(searchString) !== -1) {
              callbackCounter++;
              body = body.replace(/\/\/ 51D replace this comment with callback function./g, 'callbackFunc(resolveFunc, rejectFunc);');
              func = new Function('callbackFunc', 'resolveFunc', 'rejectFunc',// eslint-disable-line
                'try {\n' +
                body + '\n' +
                '} catch (err) {\n' +
                'console.log(err);' +
                '}'
              );
              func(completedCallback, resolve, reject);
            } else {
              func = new Function( // eslint-disable-line
                'try {\n' +
                body + '\n' +
                '} catch (err) {\n' +
                'console.log(err);' +
                '}'
              );
              func();
            }
          }
        }
      }
    }
    completedCallback(resolve, reject);
  };

  // Check if the JSON object still has any JavaScript snippets to run.
  const hasJSFunctions = function () { // eslint-disable-line
    // TODO: Fix i = i
    for (var i = i; i < json.javascriptProperties; i++) { // eslint-disable-line
      const body = getFromJson(json.javascriptProperties[i]);
      if (body !== undefined && body.length > 0) {
        return true;
      }
    }
    return false;
  };

  // Process the JavaScript properties.
  const process = function (resolve, reject) {
    processJSproperties(resolve, reject);
  };

  // Function logs errors, used to 'reject' a promise or for error callbacks.
  const catchError = function (value) {
    console.log(value.message || value);
  };

  // Populate this instance of the FOD object with getters to access the
  // properties. If the value is null then get the noValueMessage from the
  // JSON object corresponding to the property.
  const update = function (data) {
    const self = this;
    Object.getOwnPropertyNames(data).forEach(function (key) {
      self[key] = {};
      for (const i in data[key]) {
        const obj = self[key];
        (function (i) {
          Object.defineProperty(obj, i, {
            get: function () {
              if (data[key][i] === null && (i !== 'javascriptProperties' || i !== 'nullValueReasons')) {
                return data.nullValueReasons[key + '.' + i];
              } else {
                return data[key][i];
              }
            }
          });
        })(i);
      }
    });
  };

  this.onChange = function (resolve) {
    changeFuncs.push(resolve);
    if (started === false) { // eslint-disable-line
      process(resolve, catchError);
      started = true; // eslint-disable-line
    }
  };

  this.complete = function (resolve) {
    if (completed) {
      resolve(this);
    } else {
      process(resolve, catchError);
    }
  };

  // Update this instance with the initial JSON payload.
  update.call(this, json);
  this.complete(json);
};

const fod = new fiftyoneDegreesManager(); // eslint-disable-line
