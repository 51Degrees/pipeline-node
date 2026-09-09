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
 * The terms document a 51Did was created under, carried in the byte that
 * follows the match key. A 51Did created for marketing may only be used by
 * a receiver that has accepted the terms it was created under, so the terms
 * have to travel with the identifier rather than beside it, because an
 * identifier passed as a query string parameter arrives on its own and any
 * hop can drop what was sent alongside it without the identifier looking
 * any different.
 *
 * The byte is an index into a table in the specification and is not a
 * version number, so that a later document can live at any address rather
 * than only at an address a number could be turned into. A new document is
 * a new index, and every package has to be released to know it, which is
 * the cost of a receiver being able to trust what it reads. An index is
 * never reused or repointed once published, because repointing one would
 * rewrite what a past identifier says it agreed to.
 *
 * An identifier whose payload ends at the match key carries no terms byte
 * and reads as NOT_STATED, which is the right answer for it because no
 * terms are stated in it. An identifier of the Reserved type
 * reads as NOT_STATED too, because the match key length for that type is
 * not defined, so every byte after the header is the match key and no byte
 * is left for a reader to find.
 *
 * UNKNOWN is an index added after this package was released. It is
 * deliberately not NOT_STATED, because NOT_STATED says no terms are stated
 * whilst UNKNOWN says terms are stated that this package cannot name, and a
 * caller reading the second as the first would treat an identifier created
 * under terms as one created under none. A caller meeting UNKNOWN should
 * read termsIndex to find out which index it could not read, and then
 * either update this package or refuse the identifier.
 *
 * NOT_STATED does not mean the identifier is unrestricted. It means only
 * that the identifier does not carry the answer, so the answer has to come
 * from the data accompanying it, being the Terms Document Locator in an
 * OpenRTB request or whatever the surrounding protocol offers. Where both
 * are present and they disagree, the identifier's own value is the one that
 * describes the identifier, because it is inside the signature and the
 * accompanying data is not.
 *
 * The usage says where an identifier may go and the terms say which
 * document it was created under, so a receiver needs both. An identifier
 * created for non-marketing carries NOT_STATED, since the Model Terms
 * govern marketing use, and it stays barred from a demand source by its
 * usage.
 *
 * url answers with the address for an index this package knows and null for
 * every other value. This package never fetches the address, because what
 * to do with the document is the receiver's decision.
 *
 * The table, and the rule that an index this package does not know is not
 * zero, are specified once for all languages at
 * https://github.com/51Degrees/specifications/blob/main/did-specification/identifier-layout.md
 * which is the authority rather than this comment.
 */
const NAMES = ['NotStated', 'ModelTermsForMarketing2'];
const URLS = [null, 'https://m4ow.uk/mtm/2.txt'];
const UNKNOWN = -1;
const UNKNOWN_NAME = 'Unknown';
const Terms = Object.freeze({
  /**
   * An index this package does not know, being one added to the table
   * after this package was released. Not the same value as NOT_STATED,
   * because terms are stated and this package cannot name them. Read the
   * index itself from termsIndex.
   */
  UNKNOWN,
  /**
   * The terms are not stated in the identifier, which is also how an
   * identifier whose payload ends at the match key reads. The answer has
   * to come from the data accompanying the identifier.
   */
  NOT_STATED: 0,
  /** The Model Terms for Marketing, version 2, at https://m4ow.uk/mtm/2.txt. */
  MODEL_TERMS_FOR_MARKETING_2: 1,
  /**
   * The Terms value for a raw index byte, being UNKNOWN for every index
   * this package does not know.
   * @param {number} index the 1-byte terms index (0-255)
   * @returns {number} the Terms value
   */
  fromIndex (index) {
    return index >= 0 && index < NAMES.length ? index : UNKNOWN;
  },
  /**
   * The cross language name of a Terms value.
   * @param {number} terms a Terms value
   * @returns {string} for example "ModelTermsForMarketing2"
   */
  name (terms) {
    return terms === UNKNOWN ? UNKNOWN_NAME : NAMES[terms];
  },
  /**
   * The address of the terms document a Terms value stands for, or null
   * for NOT_STATED and for UNKNOWN. Never an empty string, and never an
   * address built from the index. The address is returned and never
   * fetched.
   * @param {number} terms a Terms value
   * @returns {string|null} for example "https://m4ow.uk/mtm/2.txt"
   */
  url (terms) {
    return terms === UNKNOWN ? null : URLS[terms];
  }
});
module.exports = Terms;
