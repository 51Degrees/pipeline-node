/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
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
 * A value that is not a 51Did, thrown by the surfaces that throw
 * (`FodId.fromBase64`, `FodId.fromByteArray`, `FodId.fromOwid` and the
 * constructor) when the OWID library refused the envelope. The status names
 * the reason in the same vocabulary the non-throwing surfaces report, so a
 * caller catching this can act on the reason without reading the message.
 * The two 51Did payload statuses are thrown as RangeError instead, as this
 * package has always thrown them, and that RangeError carries `status` too.
 */
class FodIdParseError extends Error {
  /**
   * Builds the error for a status.
   * @param {string} status one of `FodId.ParseStatus`
   */
  constructor (status) {
    super('The value could not be read as a 51Did (' + status + ').');
    this.name = 'FodIdParseError';
    /** @type {string} one of `FodId.ParseStatus` */
    this.status = status;
  }
}

module.exports = FodIdParseError;
