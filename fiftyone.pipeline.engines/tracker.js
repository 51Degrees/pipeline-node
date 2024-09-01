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

const DataKeyedCache = require('./dataKeyedCache');

/**
 * A tracker is an instance of datakeyed cache which,
 * if a result is found in the cache, calls an additional
 * boolean match method
 */
class Tracker extends DataKeyedCache {
  /**
   * The track method calls the dataKeyedCache get method,
   * if it receives a result it sends it onto a match function
   *
   * @param {*} key cache key to run through tracker
   * @returns {boolean} result of tracking
   */
  track (key) {
    const result = this.get(key);

    if (!result) {
      return true;
    } else {
      return this.match(key, result);
    }
  }

  /**
   * If object is found in cache, the match function is called
   *
   * @param {string} key key of piece of evidence
   * @param {*} value value of piece of evidence
   * @returns {boolean} whether put in cache
   */
  match (key, value) {
    return true;
  }
}

module.exports = Tracker;
