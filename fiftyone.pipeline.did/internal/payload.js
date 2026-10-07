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

const layout = require('./layout');
const IdType = require('../idType');
const Usage = require('../usage');
const Terms = require('./terms');

// Bit 3 of the flags byte, set where the issuer worked the usage out from a
// signal other than the caller stating it.
const USAGE_INDIRECT_BIT = 0b1000;

/**
 * Why a walk of a 51Did payload refused it, being the outcomes that belong
 * to the payload rather than to the envelope. Frozen, and compared by value
 * rather than by the text of any message.
 *
 * This module is internal to the package. Both readers of a 51Did walk the
 * payload through it and take the named values it works out, so the
 * layout is read in one place.
 */
const PayloadStatus = Object.freeze({
  /**
   * The payload is shorter than the five byte header (one byte of flags
   * and four bytes of licence id), so not even the identifier type can be
   * read.
   */
  PAYLOAD_TOO_SHORT: 'PayloadTooShort',
  /**
   * The header was read and named a type, and the payload is shorter than
   * the match key that type carries after the header (16 GUID bytes for
   * Random, 32 hash bytes for Probabilistic and HashedEmail).
   */
  INVALID_TYPE_PAYLOAD_LENGTH: 'InvalidTypePayloadLength',
  /**
   * Bits 4 and 5 of the flags byte name a payload layout version this
   * package does not know, so no field is read. A later version exists
   * precisely because a field moved, so reading the payload under the
   * layout this package knows would answer with values that are wrong
   * rather than absent.
   */
  UNSUPPORTED_PAYLOAD_VERSION: 'UnsupportedPayloadVersion',
  /**
   * Bits 0 to 2 of the flags byte are all clear, which is not a usage. The
   * cloud writes no flags byte without bit 0, so such a payload is damaged
   * or forged, and it is refused rather than offered as a fourth usage.
   */
  NO_USAGE: 'NoUsage'
});

/**
 * Reads the 51Did fields out of an envelope payload, answering with a
 * status rather than throwing. This is the one walk of the payload, shared
 * by every surface that reads a 51Did. The type is read from the header and
 * decides the least the payload must hold after the header. The terms byte
 * follows the match key, and anything beyond the terms byte is a creator
 * context section whose lengths belong to the cloud, so a longer payload is
 * accepted whatever its length.
 * @param {Uint8Array} payload the payload bytes
 * @returns {{ok: boolean, flags?: number, type?: number, usage?: number,
 * usageIsIndirect?: boolean, terms?: (string|null), licenseId?: number,
 * matchKeyLength?: number, status?: string, length?: number,
 * required?: number, payloadVersion?: number, usageBits?: number}}
 * `ok` true with the flags byte, the named values every reader answers
 * with, the licence id and the length of the match key, or `ok` false
 * with a status and the length the type needed, and the version or the
 * usage bits found where that is what the payload was refused for
 */
function unpack (payload) {
  const length = payload.length;
  if (length < layout.HEADER_LENGTH) {
    return {
      ok: false,
      status: PayloadStatus.PAYLOAD_TOO_SHORT,
      length,
      required: layout.HEADER_LENGTH
    };
  }
  const flags = payload[layout.FLAGS_OFFSET];
  // The version is read before any field, because a later version exists
  // precisely because a field moved. Reading a payload of a version this
  // package does not know under the layout it does know would answer with
  // values that are wrong rather than absent, which is worse than
  // refusing, and a version that nothing checks protects nothing.
  const payloadVersion = (flags >> 4) & 0b11;
  if (payloadVersion !== layout.SUPPORTED_PAYLOAD_VERSION) {
    return {
      ok: false,
      status: PayloadStatus.UNSUPPORTED_PAYLOAD_VERSION,
      length,
      required: layout.HEADER_LENGTH,
      payloadVersion
    };
  }
  // Usage bits 000 are not a usage. The cloud writes no flags byte without
  // bit 0, so a payload carrying them is damaged or forged, and there is
  // nothing a caller could do with a fourth usage that a refusal does not
  // already say, being that the identifier must not be passed on.
  const usageBits = flags & 0b111;
  if (usageBits === 0) {
    return {
      ok: false,
      status: PayloadStatus.NO_USAGE,
      length,
      required: layout.HEADER_LENGTH,
      usageBits
    };
  }
  // Little-endian unsigned 32-bit. `>>> 0` forces unsigned so the high bit
  // does not produce a negative number.
  const licenseId = (
    payload[layout.LICENSE_ID_OFFSET] |
    (payload[layout.LICENSE_ID_OFFSET + 1] << 8) |
    (payload[layout.LICENSE_ID_OFFSET + 2] << 16) |
    (payload[layout.LICENSE_ID_OFFSET + 3] << 24)
  ) >>> 0;
  const type = IdType.fromFlags(flags);
  let matchKeyLength;
  if (type === IdType.RANDOM) {
    matchKeyLength = layout.GUID_LENGTH;
  } else if (type === IdType.RESERVED) {
    // Not yet assigned, so read best-effort, whatever follows the header
    // is the match key.
    matchKeyLength = length - layout.HEADER_LENGTH;
  } else {
    matchKeyLength = layout.MATCH_KEY_LENGTH;
  }
  const required = layout.HEADER_LENGTH + matchKeyLength;
  if (length < required) {
    return {
      ok: false,
      status: PayloadStatus.INVALID_TYPE_PAYLOAD_LENGTH,
      length,
      required,
      type
    };
  }
  // The terms byte sits after the match key, so where it sits follows the
  // match key length the type selects. A payload with no byte to read is a
  // terms index of zero, which says the terms are not stated, so absence
  // and zero are the same answer and neither has to be told from the
  // other.
  //
  // A Reserved type cannot carry a terms byte this reader can find, because
  // the match key length for that type is not defined and every byte after
  // the header is therefore the match key. Such an identifier reads as a
  // terms index of zero, which is correct and is not a missing case here.
  const termsOffset = layout.MATCH_KEY_OFFSET + matchKeyLength;
  const termsIndex = termsOffset + layout.TERMS_LENGTH <= length
    ? payload[termsOffset]
    : Terms.NOT_STATED;
  // The named values are worked out here and nowhere else, so no reader
  // restates a bit of the flags byte or the terms table.
  return {
    ok: true,
    flags,
    type,
    usage: Usage.fromFlags(flags),
    usageIsIndirect: (flags & USAGE_INDIRECT_BIT) !== 0,
    terms: Terms.url(Terms.fromIndex(termsIndex)),
    licenseId,
    matchKeyLength
  };
}

module.exports = { PayloadStatus, unpack };
