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

const AspectData = require('./aspectData');

/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('./missingPropertyService')} MissingPropertyService
 */

/**
 * Extension of elementDataDictionary which stores a
 * {key,value} dictionary of elements like elementDataDictionary
 * but with the additional aspectData extensions
 */
class AspectDataDictionary extends AspectData {
  /**
   * Constructor for AspectDataDictionary
   *
   * @param {object} options options object
   * @param {FlowElement} options.flowElement FlowElement the data is for
   * @param {MissingPropertyService} options.missingPropertyService
   a missing property service to use when the property is in a
   * FlowElement's property list but not in the data
   * @param {object} options.contents the data to store
   */
  constructor ({ flowElement, contents, missingPropertyService }) {
    super(...arguments);

    this.contents = contents;
  }

  * [Symbol.iterator] () {
    for (let i = 0; i < Object.keys(this.contents).length; i += 1) {
      yield Object.keys(this.contents)[i];
    }
  }

  /**
   * getInternal retrieves a value from the dictionary
   *
   * @param {string} key property key
   * @returns {*} property value
   */
  getInternal (key) {
    return this.contents[key];
  }
}

module.exports = AspectDataDictionary;
