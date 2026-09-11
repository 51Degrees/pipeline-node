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
 * The byte layout of a 51Did payload. Internal to this package, because the
 * only reason to read the payload by hand is to read a field that already
 * has a name on FodId, and reading the flags byte by hand is how the usage
 * comes out backwards. The usage bits are cumulative, so a caller masking
 * for the non-marketing bit alone reads every marketing identifier as
 * non-marketing. Use the FodId accessors instead.
 *
 * The layout is described once for every language in the 51Did
 * specification, which is the authority for these numbers:
 * https://github.com/51Degrees/specifications/blob/main/did-specification/identifier-layout.md
 *
 * What each package offers on top of that layout is described in:
 * https://github.com/51Degrees/specifications/blob/main/did-specification/package-surface.md
 */
module.exports = Object.freeze({
  /** Byte offset of the flags byte within the payload. */
  FLAGS_OFFSET: 0,
  /** Byte offset of the licence id field within the payload. */
  LICENSE_ID_OFFSET: 1,
  /** Byte length of the licence id field. */
  LICENSE_ID_LENGTH: 4,
  /** Byte offset of the match key field within the payload. */
  MATCH_KEY_OFFSET: 5,
  /**
   * Byte length of the match key field for Probabilistic and HashedEmail
   * identifiers, being a SHA-256.
   */
  MATCH_KEY_LENGTH: 32,
  /**
   * Byte length of the terms field, which follows the match key. Its
   * offset is not a constant here, because the match key length depends on
   * the identifier type, so the offset is worked out from the type. A
   * payload that ends at the match key carries no terms byte and reads as
   * a terms index of zero, so the least payload lengths below do not
   * include it.
   */
  TERMS_LENGTH: 1,
  /** Byte length of the flags and licence id fields together. */
  HEADER_LENGTH: 5,
  /** Byte length of the GUID match key carried by Random identifiers. */
  GUID_LENGTH: 16,
  /**
   * The payload layout version this package reads, carried in bits 4 and
   * 5 of the flags byte. Any other version is refused rather than read
   * under this layout.
   */
  SUPPORTED_PAYLOAD_VERSION: 0,
  /** Least payload length for a Random identifier. */
  RANDOM_PAYLOAD_LENGTH: 21,
  /**
   * Least payload length for a Probabilistic or HashedEmail identifier.
   */
  PAYLOAD_LENGTH: 37
});
