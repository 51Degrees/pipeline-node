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
 * This module is internal to the package. It sits beside layout.js on the
 * internal path, and is not exported from the package entry point nor
 * reachable as a subpath, because the exports map in package.json offers
 * only the entry point. The package turns the index into the address that
 * fodId.terms answers with, so a caller never handles the byte, and the
 * names here are the ones the specification gives so that every package
 * describes one document the same way.
 *
 * UNKNOWN is an index added after this package was released, so the package
 * cannot name the document. It answers with no address, as NOT_STATED does,
 * because no package may build an address from an index it does not know,
 * since that would name a document nobody wrote.
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
// The terms table from the specification, which is the whole of the
// definition of which index is which document. It is published at
// https://github.com/51Degrees/specifications/blob/main/did-specification/identifier-layout.md#terms
// and this is the only place in the shipped code that carries it. The
// tests write the address out again on purpose, so that a test never
// compares the reader with itself.
//
// One row per terms document, at the position of the index the payload
// carries, holding the name for it and the address it stands for. A new
// terms document is one new row here and one named value below, and nothing
// else in the package changes. The name and the address sit in the same row
// so that they cannot be added apart, which two lists side by side allowed.
//
// Index 0 has a row because it is a named value the specification gives,
// and its address is null because it names no document.
//
// Each address names an exact version rather than a landing page, because a
// document at an unversioned address can be edited afterwards and a
// receiver has to know the document that was in force when the identifier
// was made.
const TABLE = [
  { name: 'NotStated', url: null },
  { name: 'ModelTermsForMarketing2', url: 'https://m4ow.uk/mtm/2.txt' }
];

// Not a row, because it stands for every index the table does not carry and
// so has no index of its own. A Terms index read from a payload is one byte,
// so it is 0 to 255 and can never be negative.
const UNKNOWN = -1;
const UNKNOWN_NAME = 'Unknown';

/**
 * The table row a Terms value stands for, and null where the value is not
 * a row, being UNKNOWN or anything else outside the table. Every lookup
 * goes through here so that the bounds are decided once and no lookup
 * subscripts the table with a value it has not checked, which would raise
 * at the caller rather than answer with no address.
 * @param {number} terms a Terms value
 * @returns {{name: string, url: string|null}|null} the row, or null
 */
function rowFor (terms) {
  return terms >= 0 && terms < TABLE.length ? TABLE[terms] : null;
}
const Terms = Object.freeze({
  /**
   * An index this package does not know, being one added to the table
   * after this package was released. It answers with no address, because
   * no address may be built from an index the package cannot name.
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
    return rowFor(index) === null ? UNKNOWN : index;
  },
  /**
   * The cross language name of a Terms value.
   * @param {number} terms a Terms value
   * @returns {string} for example "ModelTermsForMarketing2"
   */
  name (terms) {
    const row = rowFor(terms);
    return row === null ? UNKNOWN_NAME : row.name;
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
    const row = rowFor(terms);
    return row === null ? null : row.url;
  }
});
module.exports = Terms;
