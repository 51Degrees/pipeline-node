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

// This module is internal to the package.

/**
 * The standard alphabet, padded form of base 64 written in either
 * alphabet. A 51Did is issued in the standard alphabet with padding, and a
 * page that puts one in a link uses the URL safe alphabet without it.
 * Every reader of a 51Did normalises through here.
 *
 * Written by hand because the package runs in a browser as well as in
 * Node. A browser has no `Buffer`, which reads both alphabets, and its
 * `atob` refuses the URL safe one. `Uint8Array.fromBase64` is in newer
 * browsers and not in Node 24. `atob` needs no padding, which is added
 * because `FodId.toStandardBase64` answers with the form the cloud issues.
 * @param {string} value base 64 in either alphabet, with or without padding
 * @returns {string} the standard alphabet form, padded
 */
function toStandardBase64 (value) {
  let base64 = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  switch (base64.length % 4) {
    case 2: base64 += '=='; break;
    case 3: base64 += '='; break;
  }
  return base64;
}

module.exports = { toStandardBase64 };
