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

const util = require('util');
const errorMessages = require('./errorMessages');

/**
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./flowData')} FlowData
 */

/**
 * Stores information created by a flowElement based on flowData.
 * Stored in flowData
 */
class ElementData {
  /**
   * Constructor for elementData
   *
   * @param {object} options the options object
   * @param {FlowElement} options.flowElement the FlowElement this data
   * is part of
   */
  constructor ({ flowElement }) {
    if (!flowElement.dataKey) {
      throw 'flowElement dataKey not found';
    }

    this.flowElement = flowElement;

    // Returns a proxy so that we can use flowData.flowElementDataKey
    // As a shortcut to flowData.get("flowElementDataKey")
    return new Proxy(this, {
      get: (data, key) => {
        // This proxy can end up getting called by anything that tries
        // to access methods & properties on the object.
        // This can include things like the inspector if you do something like
        // console.log(flowData.location)
        // In future, this mechanism will be superseded by a less problematic
        // approach. For now, we work around this by only passing string keys
        // to the data getters.
        if (typeof (key) === 'string' || key === Symbol.iterator) {
          try {
            return data[key] || data.get(key);
          } catch (e) {
            // If the key was 'inspect' and an error was thrown then we
            // can ignore it. Otherwise, throw the error back up the stack.
            if (key !== 'inspect') {
              throw (e);
            }
          }
        }
      }
    });
  }

  /**
   * Internal get method for elementData to retrieve an element from it
   * called via the elementData's get method
   * This method is overriden by classes inheriting from elementData
   *
   * @param {string} key the key to retrieve a property value for
   */
  getInternal (key) {

  }

  /**
   * A wrapper that performs actions before passing on processing
   * (or skipping) the getInternal method
   *
   * @param {string} key the key to retrieve a property value for
   * @returns {FlowData} value
   */
  get (key) {
    const value = this.getInternal(key);
    if (typeof value === 'undefined') {
      throw util.format(errorMessages.genericMissingProperties, key) +
        (typeof this.flowElement === 'undefined'
          ? ''
          : ' in data for element "' +
          this.flowElement.dataKey) + '".' +
        util.format(errorMessages.noReasonUnknown);
    }
    return value;
  }

  /**
   * Return string value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {string} value
   */
  getAsString (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return result.toString();
    }
  }

  /**
   * Return float value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {number} float value
   */
  getAsFloat (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return parseFloat(result);
    }
  }

  /**
   * Return int value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {number} int value
   */
  getAsInteger (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return parseInt(result);
    }
  }
}

module.exports = ElementData;
