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
 * @typedef {import('./flowData')} FlowData
 */

class Helpers {
  /**
   * Set response headers in the response object (e.g. Accept-CH)
   *
   * @param {import('http').ServerResponse} response The response to set the headers in.
   * @param {FlowData} flowData A processed FlowData instance to get the response header values
   * from.
   */
  static setResponseHeaders (response, flowData) {
    for (const [key, value] of Object.entries(flowData['set-headers'].responseheadersdictionary)) {
      if (response.hasHeader(key)) {
        response.setHeader(key, `${response.getHeader(key)},${value}`);
      } else {
        response.setHeader(key, value);
      }
    }
  }
}

module.exports = Helpers;
