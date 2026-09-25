export = PublicKeys;
/**
 * A published signing key and the moment it came into force. A key stays in
 * force until the next key starts.
 * @typedef {object} PublicKeyEntry
 * @property {Date} startsAt when the key came, or comes, into force
 * @property {string} publicKey the key in SPKI PEM form
 */
/**
 * Choosing which published signing key an identifier was signed with, given
 * the key list the cloud publishes and nothing else. These are the rules
 * {@link DidClient} applies once it has fetched the list, offered on their
 * own so that a caller holding the list already, for example a page that
 * keeps it between visits, chooses a key the same way the client does and
 * never works the rule out for itself.
 *
 * The list is the answer of the cloud's `id/key/{resource}` endpoint, being
 * one entry per key with the moment the key came into force and the key in
 * SPKI PEM form. A key is in force from its start until the next entry's
 * start, so the entry for a moment is the one whose start is the latest on
 * or before it, and a moment before every start has no key.
 *
 * Nothing here fetches the list or checks a signature. {@link DidClient}
 * fetches, and {@link FodId#checkSignature} checks against the key chosen.
 */
declare const PublicKeys: Readonly<{
    /**
     * Reads the key list as the cloud's `id/key/{resource}` endpoint answers
     * it, or as a caller stored it, into entries ordered oldest start first.
     * Each entry must carry the key as `publicKey` and its start as
     * `startsAt`, or as `created` where the entry carries no `startsAt`, both
     * as a date string or a Date. Any other field, `weekStart` included, is
     * ignored. The entries and the list are frozen.
     * @param {Array<object>} entries the list as published or as stored
     * @returns {ReadonlyArray<PublicKeyEntry>} the entries, oldest first
     * @throws {TypeError} when the value is not an array, or an entry lacks a
     * readable start or a public key
     */
    fromList(entries: Array<object>): ReadonlyArray<PublicKeyEntry>;
    /**
     * The moment an identifier was created, as a Date, being the envelope's
     * date field turned back from minutes since 2020-01-01T00:00:00Z. This is
     * the moment the key for the identifier is chosen at.
     * @param {FodId | string} fodId the identifier, or its base64 in either
     * alphabet
     * @returns {Date} the creation moment
     * @throws {TypeError} when the value is neither a FodId nor a string
     * @throws {FodIdParseError} when a string is not an OWID
     * @throws {RangeError} when a string is an OWID that is not a 51Did
     */
    createdAt(fodId: FodId | string): Date;
    /**
     * The entry in force at a moment, being the one whose start is the latest
     * on or before it, or null when the moment precedes every entry.
     * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
     * @param {Date} at the moment
     * @returns {PublicKeyEntry | null} the entry in force
     * @throws {TypeError} when the list is not an array of entries, or the
     * moment is not a valid Date
     */
    inForceAt(keys: ReadonlyArray<PublicKeyEntry>, at: Date): PublicKeyEntry | null;
    /**
     * The entry in force when the identifier was created, or null when its
     * date precedes every entry in the list. The same rule as
     * {@link DidClient#publicKeyFor}, applied to a list the caller holds.
     * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
     * @param {FodId | string} fodId the identifier, or its base64 in either
     * alphabet
     * @returns {PublicKeyEntry | null} the entry in force
     * @throws {TypeError} when the list is not an array of entries, or the
     * identifier is neither a FodId nor a string
     * @throws {FodIdParseError} when a string is not an OWID
     * @throws {RangeError} when a string is an OWID that is not a 51Did
     */
    inForceFor(keys: ReadonlyArray<PublicKeyEntry>, fodId: FodId | string): PublicKeyEntry | null;
    /**
     * The entries that may have signed the identifier, best first: the entry
     * in force when it was created, then the entry in force fifteen minutes
     * earlier and the one in force fifteen minutes later, where those differ.
     * A signature is checked against these in order and no earlier key is
     * tried, which is the rule {@link DidClient#verifySignature} applies. An
     * empty list means no published key covers the identifier's date.
     * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
     * @param {FodId | string} fodId the identifier, or its base64 in either
     * alphabet
     * @returns {PublicKeyEntry[]} the entries to try, best first, at most three
     * @throws {TypeError} when the list is not an array of entries, or the
     * identifier is neither a FodId nor a string
     * @throws {FodIdParseError} when a string is not an OWID
     * @throws {RangeError} when a string is an OWID that is not a 51Did
     */
    candidatesFor(keys: ReadonlyArray<PublicKeyEntry>, fodId: FodId | string): PublicKeyEntry[];
}>;
declare namespace PublicKeys {
    export { PublicKeyEntry };
}
import FodId = require("./fodId");
/**
 * A published signing key and the moment it came into force. A key stays in
 * force until the next key starts.
 */
type PublicKeyEntry = {
    /**
     * when the key came, or comes, into force
     */
    startsAt: Date;
    /**
     * the key in SPKI PEM form
     */
    publicKey: string;
};
