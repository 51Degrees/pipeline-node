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
const coreErrorMessages = require('fiftyone.pipeline.core').ErrorMessages;
const engineErrorMessages = require('./errorMessages');
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * Base class for a missing property service that throws
 * an error if the property is not available for some reason
 **/
class MissingPropertyService {
  /**
   * Check is called if a property is requested that exists
   * in the FlowElement property list but is not available
   * in the AspectData returned by the FlowElement
   *
   * @param {string} key property key
   * @param {FlowElement} flowElement flowelement the data
   * was requested in
   */
  check (key, flowElement) {
    let message = util.format(coreErrorMessages.genericMissingProperties, key) +
      (typeof flowElement === 'undefined' ? '' : ' in data for element "' + flowElement.dataKey) + '".';

    if (this._isCloudEngine(flowElement)) {
      if (typeof flowElement.properties === 'undefined') {
        message = message +
          util.format(engineErrorMessages.cloudNoPropertiesAccess,
            flowElement.dataKey);
      } else {
        const properties = Object.getOwnPropertyNames(flowElement.properties);
        if (properties.includes(key) === false) {
          message = message +
            util.format(engineErrorMessages.cloudNoPropertyAccess,
              flowElement.dataKey, properties.join(', '));
        } else {
          message = message + util.format(engineErrorMessages.cloudReasonUnknown);
        }
      }
    } else {
      message = message + util.format(coreErrorMessages.noReasonUnknown);
    }

    throw message;
  }

  /**
   * Return true if the supplied flow element is a CloudEngine, false if not.
   *
   * @param {FlowElement} flowElement The flow element to check
   * @returns {boolean} Is CloudEngine
   */
  _isCloudEngine (flowElement) {
    try {
      if (flowElement.__proto__ === null) { // eslint-disable-line
        return false;
      } else {
        return flowElement.__proto__.constructor.name === 'CloudEngine' || // eslint-disable-line
          this._isCloudEngine(flowElement.__proto__); // eslint-disable-line
      }
    } catch (e) {
      // If some error ocurred, then assume this is not a cloud engine.
      return false;
    }
  }
}

module.exports = MissingPropertyService;
