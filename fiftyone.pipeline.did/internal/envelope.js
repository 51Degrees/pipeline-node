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
 * Finds the payload inside the OWID envelope a 51Did travels in, for the
 * reader that does not load the OWID library. It follows the envelope
 * rules the OWID library applies to a buffer holding exactly one OWID,
 * being a version of 1, 2 or 3, a creator domain of at most 253 bytes
 * ended by a zero byte, a date of two bytes in version 1 and four bytes
 * otherwise, a four byte payload length, the payload, and a 64 byte
 * signature with nothing after it.
 *
 * Nothing here checks the signature or reads the domain or the date,
 * because the reader that uses this answers only for what the payload
 * says. The envelope format itself is specified at
 * https://github.com/SWAN-community/owid
 *
 * This module is internal to the package. The tests hold it to the same
 * answer the OWID library gives for every envelope they build, so the two
 * cannot drift apart unnoticed.
 */

const { toStandardBase64 } = require('./base64');

const MAXIMUM_DOMAIN_LENGTH = 253;
const SIGNATURE_LENGTH = 64;

/**
 * The payload of the OWID envelope in a base 64 string, or null where the
 * value does not hold exactly one structurally valid envelope. The string
 * is decoded as the OWID library decodes it, so both readers accept the
 * same strings.
 * @param {*} value what was offered as a 51Did
 * @returns {Uint8Array|null} the payload bytes, or null
 */
function payloadOf (value) {
  let text;
  try {
    text = atob(toStandardBase64(value));
  } catch (e) {
    // Not a string, or not base 64.
    return null;
  }
  // Each character of the decoded text is one byte of the envelope. The
  // fields before the payload are read from the text, so the only bytes
  // copied are the payload's own.
  const version = text.charCodeAt(0);
  // The domain ends at the first zero byte, which has to arrive within the
  // longest domain there can be.
  const domainEnd = text.indexOf('\0', 1);
  if (!(version >= 1 && version <= 3) ||
      domainEnd < 0 || domainEnd - 1 > MAXIMUM_DOMAIN_LENGTH) {
    return null;
  }
  // The date follows the domain, and the payload length follows the date.
  const lengthAt = domainEnd + 1 + (version === 1 ? 2 : 4);
  // Little endian, and unsigned so that a length with the high bit set is
  // a large number rather than a negative one.
  const declared = (
    text.charCodeAt(lengthAt) | (text.charCodeAt(lengthAt + 1) << 8) |
    (text.charCodeAt(lengthAt + 2) << 16) |
    (text.charCodeAt(lengthAt + 3) << 24)) >>> 0;
  const payloadAt = lengthAt + 4;
  // The bytes after the length have to be exactly the payload and the
  // signature. An envelope that stops before its length field ends fails
  // here too, because it leaves fewer bytes than a signature, and a length
  // byte that is missing reads as zero.
  if (text.length - payloadAt - SIGNATURE_LENGTH !== declared) {
    return null;
  }
  const payload = new Uint8Array(declared);
  for (let i = 0; i < declared; i++) {
    payload[i] = text.charCodeAt(payloadAt + i);
  }
  return payload;
}

module.exports = { payloadOf };
