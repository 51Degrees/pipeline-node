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

const NAMES = ['Probabilistic', 'Random', 'HashedEmail', 'Reserved'];

/**
 * The identifier type carried in bits 6-7 of the 51Did flags byte. Existing
 * identifiers were issued with these bits zeroed, so they decode as
 * PROBABILISTIC. The type selects the length of the value that follows the
 * header in the payload.
 */
const IdType = Object.freeze({
  /** Device fingerprint + IP. Payload carries a 32-byte SHA-256 value. */
  PROBABILISTIC: 0,
  /** Server-generated random GUID. Payload carries 16 GUID bytes. */
  RANDOM: 1,
  /** Caller email + salt. Payload carries a 32-byte SHA-256 value. */
  HASHED_EMAIL: 2,
  /** Not yet assigned. Parsed best-effort; remaining bytes exposed as-is. */
  RESERVED: 3,

  /**
   * Decodes the identifier type from the top two bits (6-7) of a flags byte.
   * @param {number} flags the 1-byte flags value (0-255)
   * @returns {number} the IdType value
   */
  fromFlags (flags) {
    return (flags >> 6) & 0b11;
  },

  /**
   * The human-readable name of an IdType value.
   * @param {number} type an IdType value
   * @returns {string}
   */
  name (type) {
    return NAMES[type];
  }
});

module.exports = IdType;
