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

const FlowElement = require('./flowElement.js');
const ElementDataDictionary = require('./elementDataDictionary.js');
const AspectPropertyValue = require('./aspectPropertyValue');
// SetHeader source headers separator
const SOURCE_HEADER_SEPARATOR = ',';

/**
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./flowData')} FlowData
 */
/**
 * Set response headers element class. This is used to get response
 * headers based on what the browser supports. For example, newer
 * Chrome browsers support the Accept-CH header.
 */
class SetHeadersElement extends FlowElement {
  constructor () {
    super(...arguments);

    this.dataKey = 'set-headers';
    this.properties = {
      responseheadersdictionary: {
        name: 'ResponseHeadersDictionary',
        type: 'object'
      }
    };
    this.headers = null;
  }

  /**
   * Get the name of the header which the property relates to.
   *
   * @param {string} propertyName To get the header name from.
   * @returns {string} Header name.
   */
  getHeaderName (propertyName) {
    // Skip over the 'SetHeader' prefix.
    let str = propertyName.replace('SetHeader', '');
    // Skip over the first uppercase character in the component
    // name.
    str = str.substr(1);
    // Now keep skipping until the next uppercase character is
    // found.
    while (str[0] >= 'a' && str[0] <= 'z') {
      str = str.substr(1);
    }
    return str;
  }

  /**
   * Construct the headers and their properties which can be set
   * by the service.
   * An example of the structure of the headers is:
   *   { 'Accept-CH':
   *     { name: 'Accept-CH',
   *       properties:
   *         [ 'device.SetHeaderBrowserAccept-CH',
   *           'device.SetHeaderPlatformAccept-CH',
   *           'device.SetHeaderHardwareAccept-CH' ] } }
   *
   * @param {Pipeline} pipeline The pipeline instance to get the properties from.
   * @returns {object} Collection of headers which can be set in the response.
   */
  constructHeaders (pipeline) {
    const headers = {};

    for (const [dataKey, element] of Object.entries(pipeline.flowElements)) {
      if (element.properties !== undefined && element.properties !== null) {
        for (const [propertyKey, property] of Object.entries(element.properties)) {
          if (property.name && property.name.startsWith('SetHeader')) {
            const headerName = this.getHeaderName(property.name);
            if (headers[headerName] === undefined) {
              headers[headerName] = {
                name: headerName,
                properties: []
              };
            }
            headers[headerName].properties.push(dataKey + '.' + propertyKey);
          }
        }
      }
    }
    return headers;
  }

  /**
   * Add the response header dictionary to the FlowData.
   *
   * @param {FlowData} flowData the FlowData being processed
   */
  processInternal (flowData) {
    if (this.headers === null) {
      this.headers = this.constructHeaders(flowData.pipeline);
    }

    const data = new ElementDataDictionary({
      flowElement: this,
      contents: { responseheadersdictionary: this.getResponseHeaders(flowData) }
    });

    flowData.setElementData(data);
  }

  /**
   * Get response headers (e.g. Accept-CH)
   *
   * @param {FlowData} flowData A processed FlowData instance to get the response header values
   * from.
   * @returns {object} A dictionary of response header names with their values if they are not
   * null
   */
  getResponseHeaders (flowData) {
    const result = {};
    for (const [, header] of Object.entries(this.headers)) {
      const headerValue = new Set();
      header.properties.forEach(property => {
        const keys = property.split('.');
        const value = this.tryGetValue(flowData, keys[0], keys[1]);
        if (value !== undefined && value !== '') {
          value.split(SOURCE_HEADER_SEPARATOR).forEach((v) => {
            headerValue.add(v);
          });
        }
      });
      if (headerValue.size > 0) {
        result[header.name] =
          Array.from(headerValue).join(SOURCE_HEADER_SEPARATOR);
      }
    }
    return result;
  }

  /**
   * Try to get the value for the given element and property.
   * If the value cannot be found or is null/unknown, then undefined
   * is returned.
   *
   * @param {FlowData} flowData A processed FlowData instance to get the value from.
   * @param {string} elementKey Key for the element data to get the value from.
   * @param {string} propertyKey Name of the property to get the value for.
   * @returns {string | undefined} value string or undefined.
   */
  tryGetValue (flowData, elementKey, propertyKey) {
    let element;
    try {
      element = flowData[elementKey];
    } catch (e) {
      flowData.pipeline.log('error', 'Element \'' + elementKey + '\' is not present in the FlowData');
      return undefined;
    }

    try {
      const value = element[propertyKey];
      if (value !== undefined && value !== null) {
        if (value instanceof AspectPropertyValue) {
          if (value.hasValue && value.value !== 'Unknown') {
            return value.value;
          } else {
            return undefined;
          }
        } else {
          return value.toString();
        }
      }
    } catch (e) {
      flowData.pipeline.log('info', `Property '${propertyKey}' is not present in the ${elementKey} element.`);
      return undefined;
    }

    return undefined;
  }
}

module.exports = SetHeadersElement;
