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

const engines = require('fiftyone.pipeline.engines');

const Tracker = engines.Tracker;
const LRU = engines.Lru;

/**
 * The ShareUsageTracker is used by the ShareUsageElement to determine
 * whether to put evidence into a bundle to be sent to the 51Degrees
 * Share Usage service.
 **/
class ShareUsageTracker extends Tracker {
  /**
   * Constructor for ShareUsageTracker
   *
   * @param {object} options options for share usage tracker
   * @param {number} options.size size of the share usage lru cache
   * @param {number} options.interval if identical evidence values are seen by the tracker within this interval (in milliseconds) it will be ignored by the tracker.
   **/
  constructor ({ size = 1000, interval = 1200000 } = {}) {
    super(...arguments);

    this.cache = new LRU(size);

    this.interval = interval;
  }

  /**
   * Function to check if we should put the evidence in the cache
   *
   * @param {object} options options for match
   * @param {string} options.key key of piece of evidence
   * @param {*} options.value value of piece of evidence
   * @returns {boolean} whether put in cache
   **/
  match ({ key, value }) {
    const difference = Date.now() - value;

    if (difference > this.interval) {
      this.put(key, value);

      return true;
    } else {
      return false;
    }
  }

  /**
   * Retreive entry from cache
   *
   * @param {object} cacheKey key value store of evidence to lookup
   * @returns {*} value stored in cache
   **/
  get (cacheKey) {
    return this.cache.read(cacheKey);
  }

  /**
   * Put entry in cache
   *
   * @param {object} cacheKey key value store of evidence
   * to place in cache
   **/
  put (cacheKey) {
    this.cache.write(cacheKey, Date.now());
  }
}

module.exports = ShareUsageTracker;
