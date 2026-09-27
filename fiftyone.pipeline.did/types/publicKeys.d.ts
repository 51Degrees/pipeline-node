export = PublicKeys;
/**
 * A published signing key and the moment it came into force. A key stays in
 * force until its `endsAt`, or until the next key starts where the entry
 * carries no `endsAt`.
 * @typedef {object} PublicKeyEntry
 * @property {Date} startsAt when the key came, or comes, into force
 * @property {Date} [endsAt] when the key stops being in force, where the
 * list gives it. A key can be replaced before then, and the list then gives
 * the earlier moment.
 * @property {string} publicKey the key in SPKI PEM form
 */
/**
 * Chooses which published signing key an identifier was signed with, from
 * the list the cloud's `id/key/{resource}` endpoint answers. {@link DidClient}
 * applies these rules to the list it fetches, and a caller that already
 * holds the list applies them here, so there is one rule. A key is in force
 * from its start until its `endsAt`, or until the next entry's start where
 * it carries none, so the entry for a moment is the one whose start is the
 * latest on or before it, and a moment before every start, or at or after
 * that entry's `endsAt`, has no key. The cloud publishes a key only from
 * shortly before its period starts, so {@link PublicKeys.covers} says when
 * the list held must be fetched again and {@link PublicKeys.merge} adds the
 * answer to it. Nothing here fetches the list or checks a signature.
 */
declare const PublicKeys: Readonly<{
    /**
     * Reads the key list as the cloud's `id/key/{resource}` endpoint answers
     * it, or as a caller stored it, into entries ordered oldest start first.
     * Each entry must carry the key as `publicKey` and its start as
     * `startsAt`, or as `created` where the entry carries no `startsAt`, both
     * as a date string or a Date. `endsAt` is kept where an entry carries it,
     * in either form, and an entry without it is valid. Any other field,
     * `weekStart` included, is ignored. The entries and the list are frozen.
     * @param {Array<object>} entries the list as published or as stored
     * @returns {ReadonlyArray<PublicKeyEntry>} the entries, oldest first
     * @throws {TypeError} when the value is not an array, or an entry lacks a
     * readable start or a public key, or carries an `endsAt` that is not a
     * readable date after its start
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
     * on or before it, or null when the moment precedes every entry or is at
     * or after that entry's `endsAt`.
     * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
     * @param {Date} at the moment
     * @returns {PublicKeyEntry | null} the entry in force
     * @throws {TypeError} when the list is not an array of entries, or the
     * moment is not a valid Date
     */
    inForceAt(keys: ReadonlyArray<PublicKeyEntry>, at: Date): PublicKeyEntry | null;
    /**
     * The entry in force when the identifier was created, or null when its
     * date precedes every entry in the list or is at or after that entry's
     * `endsAt`. The same rule as {@link DidClient#publicKeyFor}, applied to a
     * list the caller holds.
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
     * empty list means no key in the list covers the identifier's date.
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
    /**
     * Whether the list answers for something created at the moment without
     * being fetched again. The list ends at its newest entry's `endsAt`, or
     * at that entry's start where it carries none. It answers while the
     * moment plus the boundary tolerance is before that end, so the key after
     * a boundary is held whenever it may have signed the identifier. False
     * for an empty list.
     * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
     * @param {Date} date the moment, as {@link PublicKeys.createdAt} gives it
     * @returns {boolean} true when the list answers without a fetch
     * @throws {TypeError} when the list is not an array of entries, or the
     * moment is not a valid Date
     */
    covers(keys: ReadonlyArray<PublicKeyEntry>, date: Date): boolean;
    /**
     * The list held with a later answer merged in by start. Each entry of the
     * answer is added, or replaces the held entry with the same start, so a
     * later `endsAt` takes the place of an earlier one or of none. No held
     * entry is dropped, because an identifier made long ago is checked
     * against the key of its own period. Neither list is changed.
     * @param {ReadonlyArray<PublicKeyEntry>} held the list held, in any order
     * @param {ReadonlyArray<PublicKeyEntry>} answer the later answer, read with
     * {@link PublicKeys.fromList}, in any order
     * @returns {ReadonlyArray<PublicKeyEntry>} the merged list, frozen, oldest
     * start first
     * @throws {TypeError} when either list is not an array of entries
     */
    merge(held: ReadonlyArray<PublicKeyEntry>, answer: ReadonlyArray<PublicKeyEntry>): ReadonlyArray<PublicKeyEntry>;
}>;
declare namespace PublicKeys {
    export { PublicKeyEntry };
}
import FodId = require("./fodId");
/**
 * A published signing key and the moment it came into force. A key stays in
 * force until its `endsAt`, or until the next key starts where the entry
 * carries no `endsAt`.
 */
type PublicKeyEntry = {
    /**
     * when the key came, or comes, into force
     */
    startsAt: Date;
    /**
     * when the key stops being in force, where the
     * list gives it. A key can be replaced before then, and the list then gives
     * the earlier moment.
     */
    endsAt?: Date;
    /**
     * the key in SPKI PEM form
     */
    publicKey: string;
};
