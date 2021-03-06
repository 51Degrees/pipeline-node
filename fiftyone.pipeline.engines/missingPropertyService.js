/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2019 51 Degrees Mobile Experts Limited, 5 Charlotte Close,
 * Caversham, Reading, Berkshire, United Kingdom RG4 7BY.
 *
 * This Original Work is licensed under the European Union Public Licence (EUPL)
 * v.1.2 and is subject to its terms as set out below.
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
   * @param {flowElement} flowElement flowelement the data
   * was requested in
   */
  check (key, flowElement) {
    let message = util.format(errorMessages.genericMissingProperties, key) + 
      (typeof flowElement === 'undefined' ? '' : ' in data for element "' + flowElement.dataKey) + '".';

    if (this._isCloudEngine(flowElement)) {
      if (typeof flowElement.properties === 'undefined') {
        message = message +
          util.format(errorMessages.cloudNoPropertiesAccess,
            flowElement.dataKey);
      } else {
        var properties = Object.getOwnPropertyNames(flowElement.properties);
        if (properties.includes(key) === false) {
          message = message +
            util.format(errorMessages.cloudNoPropertyAccess,
              flowElement.dataKey, properties.join(', '));
        } else {
          message = message + util.format(errorMessages.cloudReasonUnknown);
        }
      }
    } else {
      message = message + util.format(errorMessages.noReasonUnknown);
    }

    throw message;
  }

  /**
   * Return true if the supplied flow element is a CloudEngine, false if not.
   * @param {flowElement} flowElement The flow element to check
   */
  _isCloudEngine (flowElement) {
    try {
      if (flowElement.__proto__ === null) {
        return false;
      } else {
        return flowElement.__proto__.constructor.name === 'CloudEngine' ||
          this._isCloudEngine(flowElement.__proto__);
      }
    } catch (e) {
      // If some error ocurred, then assume this is not a cloud engine.
      return false;
    }
  }
}

module.exports = MissingPropertyService;
