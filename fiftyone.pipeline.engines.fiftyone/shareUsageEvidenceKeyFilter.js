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

const EvidenceKeyFilter = require('fiftyone.pipeline.core').EvidenceKeyFilter;

/**
 * The ShareUsageEvidenceKeyFilter filters out all evidence
 * not needed by the 51Degrees ShareUsage service.
 * It allows for a specific whitelist of query strings,
 * a blacklist of headers and a specific cookie used for session information
 */
class ShareUsageEvidenceKeyFilter extends EvidenceKeyFilter {
  /**
   * Constructor for ShareUsageEvidenceKeyFilter
   *
   * @param {object} options options for filter
   * @param {string} options.cookie cookie used for session data
   * @param {Array} options.queryWhitelist whitelist of query string data
   * @param {Array} options.headerBlacklist blacklist of headers to remove
   */
  constructor ({ cookie, queryWhitelist = [], headerBlacklist = [] }) {
    super(...arguments);

    this.includedQueryStringParams = queryWhitelist;
    this.blockedHttpHeaders = headerBlacklist;
    this.cookie = cookie;
    if (!cookie &&
      (!queryWhitelist || queryWhitelist.length === 0) &&
      (!headerBlacklist || headerBlacklist.length === 0)) {
      this.shareAll = true;
    } else {
      this.shareAll = false;
    }
  }

  /**
   * Check if a specific key should be filtered
   *
   * @param {string} key evidence key to filter
   * @returns {boolean} whether to keep the evidence
   **/
  filterEvidenceKey (key) {
    const prefix = key.toLowerCase().split('.')[0];
    const suffix = key.toLowerCase().split('.')[1];

    let result = this.shareAll;

    if (!this.shareAll) {
      if (prefix === 'header') {
        // Add the header to the list if the header name does not
        // appear in the list of blocked headers.
        result = this.blockedHttpHeaders
          .includes(suffix) === false;
      } else if (prefix === 'cookie') {
        // Only add cookies that start with the 51Degrees cookie
        // prefix.
        result = suffix.indexOf('51d_') === 0 ||
          (this.includeSession && suffix === this.cookie);
      } else if (prefix === 'session') {
        // Only add session values that start with the 51Degrees
        // cookie prefix.
        result = suffix.indexOf('51d_') === 0;
      } else if (prefix === 'query') {
        // If no query string parameter filter was specified
        // then share all of them.
        // Otherwise, only include query string parameters that
        // start with 51d_ or that have been specified in
        // the constructor.
        result = this.includedQueryStringParams === null ||
          suffix.indexOf('51d_') === 0 ||
            this.includedQueryStringParams.includes(suffix);
      } else {
        // Add anything that is not a cookie, header, session
        // variable or query string parameter.
        result = true;
      }
    }
    return result;
  }
}

module.exports = ShareUsageEvidenceKeyFilter;
