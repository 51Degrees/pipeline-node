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

/**
 * An AspectPropertyValue is a wrapper for a value
 * It lets you check this wrapper has a value inside it
 * If not value is set, a specific no value message is returned
 */
class AspectPropertyValue {
  /**
   * Constructor for AspectPropertyValue
   *
   * @param {string} noValueMessage The message to show when no value is set
   * @param {*} value The value inside the wrapper
   */
  constructor (noValueMessage = 'No value has been set.', value) {
    if (typeof value !== 'undefined') {
      this.noValueMessage = null;
      this._value = value;
      this.hasValue = true;
    } else {
      this.noValueMessage = noValueMessage;
      this.hasValue = false;
    }
  }

  /**
   * Get the value of this instance.
   *
   * @returns {*} The value of the property
   * @throws Will throw error if 'hasValue' is false.
   */
  get value () {
    if (this.hasValue) {
      return this._value;
    } else {
      throw this.noValueMessage;
    }
  }

  /**
   * Set the value of this instance.
   *
   * @param {*} value the value to set
   */
  set value (value) {
    if (typeof value !== 'undefined') {
      this._value = value;
      this.hasValue = true;
    } else {
      this._value = undefined;
      this.hasValue = false;
    }
  }
}

module.exports = AspectPropertyValue;
