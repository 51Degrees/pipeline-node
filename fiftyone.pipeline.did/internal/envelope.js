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

const SUPPORTED_VERSIONS = [1, 2, 3];
const MAXIMUM_DOMAIN_LENGTH = 253;
const SIGNATURE_LENGTH = 64;

/**
 * The bytes of a base 64 string in either alphabet, with or without
 * padding, or null where the value is not a string or not base 64.
 * @param {*} value what was offered as a 51Did
 * @returns {Uint8Array|null} the bytes, or null
 */
function bytesOf (value) {
  if (typeof value !== 'string') {
    return null;
  }
  let base64 = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (base64.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    return null;
  }
  switch (base64.length % 4) {
    case 2: base64 += '=='; break;
    case 3: base64 += '='; break;
  }
  let text;
  try {
    text = atob(base64);
  } catch (e) {
    return null;
  }
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes;
}

/**
 * The payload of the OWID envelope in a base 64 string, or null where the
 * string does not hold exactly one structurally valid envelope.
 * @param {*} value what was offered as a 51Did
 * @returns {Uint8Array|null} a copy of the payload bytes, or null
 */
function payloadOf (value) {
  const bytes = bytesOf(value);
  if (bytes === null || bytes.length === 0) {
    return null;
  }
  const total = bytes.length;
  let at = 0;
  const version = bytes[at++];
  if (SUPPORTED_VERSIONS.indexOf(version) === -1) {
    return null;
  }
  // The domain ends at the first zero byte, which has to arrive within the
  // longest domain there can be.
  const limit = Math.min(total, at + MAXIMUM_DOMAIN_LENGTH + 1);
  let ended = false;
  while (at < limit) {
    if (bytes[at++] === 0) {
      ended = true;
      break;
    }
  }
  if (!ended) {
    return null;
  }
  at += version === 1 ? 2 : 4;
  if (total - at < 4) {
    return null;
  }
  // Little endian, and unsigned so that a length with the high bit set is
  // a large number rather than a negative one.
  const declared = (
    bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) |
    (bytes[at + 3] << 24)) >>> 0;
  at += 4;
  if (total - at - SIGNATURE_LENGTH !== declared) {
    return null;
  }
  return bytes.slice(at, at + declared);
}

module.exports = { payloadOf };
