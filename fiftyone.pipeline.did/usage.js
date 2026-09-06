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
 * The usage a 51Did was created for, carried in bits 0-2 of the flags
 * byte. It decides where the identifier may go: one created for
 * NON_MARKETING must never be passed to a demand source, and one created
 * for STANDARD or PERSONALIZED may be passed only to a recipient that has
 * accepted the applicable terms.
 *
 * The three usages are cumulative rather than exclusive in the byte.
 * Non-marketing sets bit 0, standard sets bits 0 and 1, and personalized
 * sets bits 0, 1 and 2, so every marketing identifier also carries the
 * non-marketing bit. A caller who masked the byte for that bit alone would
 * read every marketing identifier as non-marketing, which is the wrong way
 * round for a data protection decision. fromFlags answers with the highest
 * usage granted, so that mistake cannot be made.
 *
 * The names match the cloud's id.usage values, non-marketing, standard and
 * personalized, and are the same in every 51Did package. The bits, and the
 * rule that the highest granted usage is the answer, are specified once for
 * all languages at
 * https://github.com/51Degrees/specifications/blob/main/did-specification/identifier-layout.md
 * which is the authority rather than this comment.
 */
const NAMES = ['None', 'NonMarketing', 'Standard', 'Personalized'];
const ID_USAGE = [null, 'non-marketing', 'standard', 'personalized'];
const Usage = Object.freeze({
  /**
   * No usage bit is set. The cloud never issues such an identifier, so
   * this is an identifier from somewhere else or a damaged one, and it
   * should be treated as though it may not be passed on.
   */
  NONE: 0,
  /** Created for use that is not marketing. Must not be passed to a demand source. */
  NON_MARKETING: 1,
  /** Created for standard marketing, being targeting unrelated to browsing history. */
  STANDARD: 2,
  /** Created for personalized marketing, being targeting related to browsing history. */
  PERSONALIZED: 3,
  /**
   * Decodes the usage from bits 0-2 of a flags byte, as the highest usage
   * granted.
   * @param {number} flags the 1-byte flags value (0-255)
   * @returns {number} the Usage value
   */
  fromFlags (flags) {
    if (flags & 0b100) return 3;
    if (flags & 0b010) return 2;
    if (flags & 0b001) return 1;
    return 0;
  },
  /**
   * The cross language name of a Usage value.
   * @param {number} usage a Usage value, 0 to 3
   * @returns {string} for example "NonMarketing"
   */
  name (usage) {
    return NAMES[usage];
  },
  /**
   * The cloud's id.usage value for a Usage value, or null for NONE.
   * @param {number} usage a Usage value, 0 to 3
   * @returns {string|null} for example "non-marketing"
   */
  idUsage (usage) {
    return ID_USAGE[usage];
  }
});
module.exports = Usage;
