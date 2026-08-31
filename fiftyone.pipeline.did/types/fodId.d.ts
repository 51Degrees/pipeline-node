export = FodId;
/**
 * The answer from {@link FodId.tryParse} and {@link FodId.tryFromByteArray}.
 * Frozen. On success `ok` is true, `value` is the identifier and `status`
 * is `ParseStatus.PARSED`. On failure `ok` is false, `value` is null, never
 * a half read identifier, and `status` names the reason.
 * @typedef {object} FodIdParseResult
 * @property {boolean} ok whether the input was a structurally valid 51Did
 * @property {FodId | null} value the identifier on success, null on failure
 * @property {string} status one of {@link FodId.ParseStatus}
 */
/**
 * A strongly typed reader for the 51Did (51Degrees Identifier) value returned
 * by the 51Degrees Cloud service.
 *
 * A 51Did is described at three levels. The 51Did is the identifier as a
 * whole. The envelope is the signed OWID that carries it (version, domain,
 * date, payload, signature), re-issued fresh on every call. The match key
 * is the stable, comparable part of the payload after the Flags and License
 * Id, exposed via {@link FodId#matchKey}. Two 51Dids for the same inputs
 * share the same match key even though their envelopes differ. Compare
 * match keys, never envelopes.
 *
 * Reading and verifying are two separate questions. {@link FodId.tryParse}
 * and {@link FodId.tryFromByteArray} answer whether the input is a
 * structurally valid 51Did, with a status rather than an exception, and a
 * successful read says nothing about the signature. {@link FodId.fromBase64}
 * and {@link FodId.fromByteArray} are the same read for callers who prefer
 * an exception. No read fetches a key or checks a signature, so a parsed
 * 51Did is not necessarily genuine. Call {@link FodId#verify} or
 * {@link FodId#checkSignature} for that.
 *
 * A FodId composes the OWID the OWID library read (holds it and delegates
 * the envelope fields to it). That OWID is frozen and hands out its byte
 * arrays as copies, so nothing a caller holds can change the identifier.
 */
declare class FodId {
    static FLAGS_OFFSET: number;
    static LICENSE_ID_OFFSET: number;
    static LICENSE_ID_LENGTH: number;
    /** Byte offset of the match key field within the payload. */
    static HASH_OFFSET: number;
    /**
     * Byte length of the match key field for Probabilistic and HashedEmail
     * identifiers, being a SHA-256.
     */
    static HASH_LENGTH: number;
    static HEADER_LENGTH: number;
    /** Byte length of the GUID match key carried by Random identifiers. */
    static GUID_LENGTH: number;
    static RANDOM_PAYLOAD_LENGTH: number;
    static PAYLOAD_LENGTH: number;
    /**
     * Why a read succeeded or failed, being the OWID library's statuses plus
     * `PAYLOAD_TOO_SHORT` and `INVALID_TYPE_PAYLOAD_LENGTH`. Frozen.
     * @type {Readonly<Record<string, string>>}
     */
    static ParseStatus: Readonly<Record<string, string>>;
    /**
     * The outcome of asking whether a signature is genuine, as reported by
     * {@link FodId#checkSignature}. The OWID library's own frozen object.
     * Only `SIGNATURE_VALID` and `SIGNATURE_INVALID` judge the signature, and
     * every other member says the question could not be answered.
     * @type {Readonly<Record<string, string>>}
     */
    static SignatureStatus: Readonly<Record<string, string>>;
    /**
     * Restores a base64 string in either alphabet to the standard alphabet
     * with padding, which is the only form the OWID library decodes. Leading
     * and trailing whitespace is stripped first, so a value carried through a
     * log line, a text field or a copy and paste with a stray newline still
     * parses. The URL-safe characters `-` and `_` become `+` and `/`, then
     * padding is added where the stripped length calls for it. A string
     * already in the standard form comes back unchanged.
     * @param {string} value base64 in the standard or URL-safe alphabet, with
     * or without padding, and with or without surrounding whitespace
     * @returns {string} the same bytes in the standard alphabet with padding
     */
    static toStandardBase64(value: string): string;
    /**
     * Converts a base64 string in either alphabet to the URL-safe alphabet
     * without padding, the inverse of {@link FodId.toStandardBase64}, so the
     * value can be placed in a URL without further encoding.
     * @param {string} value base64 in the standard or URL-safe alphabet
     * @returns {string} the same bytes in the URL-safe alphabet, no padding
     */
    static toBase64Url(value: string): string;
    /**
     * Reads a 51Did from its base64 form without throwing. Both base64
     * alphabets are accepted, the standard one the cloud issues and the
     * URL-safe one a page uses in a link, with or without padding. The value
     * may be anything at all, because a 51Did arrives from outside and
     * failing to be one is an ordinary outcome. An absent value or an empty
     * string is `MISSING_INPUT`, a value that is not a string is
     * `INVALID_INPUT_TYPE`, and a reason from the OWID library is reported
     * exactly as the OWID library reported it.
     *
     * A successful read says the bytes are a structurally valid 51Did. It
     * fetches no key and checks no signature, so the identifier may still be
     * a forgery. Call {@link FodId#verify} or {@link FodId#checkSignature}.
     * @param {string} base64 the envelope in either base64 alphabet
     * @returns {FodIdParseResult} a frozen result with `ok`, `value` and
     * `status`
     */
    static tryParse(base64: string): FodIdParseResult;
    /**
     * Reads a 51Did from the raw bytes of an OWID envelope without throwing.
     * The buffer must hold exactly one envelope, as `owid.parseBytes`
     * requires. An absent buffer or one of no bytes is `MISSING_INPUT`, a
     * value that is not a byte array is `INVALID_INPUT_TYPE`, and a reason
     * from the OWID library is reported exactly as the OWID library reported
     * it. The bytes are copied, so changing the buffer afterwards does not
     * change the identifier.
     * @param {Uint8Array} buffer the envelope bytes
     * @returns {FodIdParseResult} a frozen result with `ok`, `value` and
     * `status`
     */
    static tryFromByteArray(buffer: Uint8Array): FodIdParseResult;
    /**
     * Parses a 51Did from its base64-encoded OWID string, throwing when the
     * value is not one. The same read as {@link FodId.tryParse}, for a caller
     * who prefers an exception. Both base64 alphabets are accepted, and the
     * envelope is held in the standard form, so {@link FodId#asBase64}
     * returns the standard alphabet with padding whichever form was given.
     * @param {string} base64 the envelope in either base64 alphabet
     * @returns {FodId} the parsed identifier, whose signature has not been
     * checked
     * @throws {TypeError} when the value is not a string
     * @throws {RangeError} when the payload is shorter than a 51Did of its
     * type can be
     * @throws {FodIdParseError} when the value is not an OWID, with the OWID
     * library's status
     */
    static fromBase64(base64: string): FodId;
    /**
     * Parses a 51Did from the raw bytes of an OWID envelope, throwing when
     * the bytes are not one. The same read as {@link FodId.tryFromByteArray}.
     * @param {Uint8Array} buffer the envelope bytes
     * @returns {FodId} the parsed identifier, whose signature has not been
     * checked
     * @throws {TypeError} when the value is not a Uint8Array
     * @throws {RangeError} when the payload is shorter than a 51Did of its
     * type can be
     * @throws {FodIdParseError} when the bytes are not an OWID, with the OWID
     * library's status
     */
    static fromByteArray(buffer: Uint8Array): FodId;
    /**
     * Promotes an OWID the OWID library read into a 51Did. The OWID is not
     * aliased. Its base64 is read again through the same walk as
     * {@link FodId.fromBase64}, so the FodId can never disagree with its
     * envelope.
     * @param {object} owidInstance an OWID from `owid.parse` or
     * `owid.parseBytes`
     * @returns {FodId} the parsed identifier, whose signature has not been
     * checked
     * @throws {TypeError} when no OWID was given
     */
    static fromOwid(owidInstance: object): FodId;
    /**
     * Builds a 51Did from an OWID the OWID library read. The OWID is not
     * aliased. Its base64 is read again through the same walk every other
     * surface uses, so a FodId built this way is identical to one from
     * {@link FodId.fromBase64} and can never disagree with its envelope.
     * @param {object} owidInstance an OWID from `owid.parse` or
     * `owid.parseBytes`, or any object carrying the envelope base64 as `data`
     * @throws {TypeError} when no OWID was given
     * @throws {RangeError} when the payload is shorter than a 51Did of its
     * type can be
     * @throws {FodIdParseError} when the base64 is not an OWID
     */
    constructor(owidInstance: object);
    /** @type {object} the OWID the OWID library read, frozen */
    _owid: object;
    /** @type {number} the flags byte */
    _flags: number;
    /** @type {number} the licence id field, unsigned */
    _licenseId: number;
    /** @type {Uint8Array} this identifier's own copy of the match key bytes */
    _matchKey: Uint8Array;
    /** @returns {number} the 1-byte usage flags bit-mask (0-255). */
    get flags(): number;
    /** @returns {number} the IdType carried in bits 6-7 of the flags. */
    get type(): number;
    /**
     * The 4-byte little-endian field at offset 1 of the payload, as an
     * unsigned integer (0-4294967295).
     *
     * On an identifier carrying a creator context these four bytes hold an
     * encrypted value that only 51Degrees can turn back into a licence
     * identifier, so the number returned here is the field's raw value and
     * identifies nothing outside 51Degrees. It is still stable for a given
     * identifier, so it remains usable as an opaque part of the payload, but
     * it must not be read as a licence number.
     * @returns {number} the raw field value
     */
    get licenseId(): number;
    /**
     * The match key, being the stable, comparable part of the payload after
     * the Flags and License Id. A 32-byte SHA-256 for Probabilistic and
     * HashedEmail identifiers, or 16 GUID bytes for Random. Two 51Dids for
     * the same inputs share the same match key, so the match key is the
     * cache and deduplication key.
     * @returns {Uint8Array} a defensive copy of the match key bytes
     */
    get matchKey(): Uint8Array;
    /**
     * Deprecated alias for {@link FodId#matchKey}. The stable, comparable
     * part of a 51Did is now called the match key, mirroring the Model Terms
     * for Marketing vocabulary. This alias will be removed in a future
     * release.
     * @deprecated Renamed to matchKey. This alias will be removed in a future
     * release.
     * @returns {Uint8Array} the same bytes as {@link FodId#matchKey}
     */
    get hash(): Uint8Array;
    /** @returns {number} the OWID version. */
    get version(): number;
    /** @returns {string} the domain of the OWID creator. */
    get domain(): string;
    /**
     * @returns {number} the OWID date as minutes since 2020-01-01 UTC, as an
     * unsigned 32-bit number, the same value as {@link FodId#dateMinutes}.
     */
    get date(): number;
    /**
     * The envelope's own date as the unsigned 32-bit count of minutes since
     * 2020-01-01T00:00:00Z, exactly as the wire carries it. This is the value
     * the OWID `public-key?date=` parameter takes, and the integer to use when
     * comparing creation times. The OWID library now reads the field unsigned
     * too, so {@link FodId#date} agrees with this getter. The getter is kept
     * because callers were told to use it, and it still forces the unsigned
     * reading should the field ever arrive signed.
     * @returns {number} minutes since 2020-01-01T00:00:00Z
     */
    get dateMinutes(): number;
    /** @returns {Uint8Array} a fresh copy of the OWID payload bytes. */
    get payload(): Uint8Array;
    /** @returns {Uint8Array} a fresh copy of the 64-byte OWID signature. */
    get signature(): Uint8Array;
    /**
     * @returns {string} the OWID as a base64 string in the standard alphabet
     * with padding, the form the cloud issues.
     */
    asBase64(): string;
    /**
     * The envelope in the URL-safe base64 alphabet without padding, the form
     * to place in a URL or a link. {@link FodId.fromBase64} accepts it back.
     * @returns {string} the OWID as URL-safe base64, no padding
     */
    asBase64Url(): string;
    /** @returns {Uint8Array} the OWID envelope as raw bytes. */
    asByteArray(): Uint8Array;
    /**
     * Verifies the OWID signature against the supplied SPKI public key PEM,
     * offline. This is an explicit, separate step, because no read verifies.
     * Resolves true or false only when the signature was judged, and rejects
     * when the question could not be answered (a key that cannot be imported,
     * or no Web Crypto), because a caller told false would treat an outage as
     * a forgery. {@link FodId#checkSignature} reports the same outcomes as
     * named statuses. Asynchronous because it uses Web Crypto.
     * @param {string} publicPem the creator public key in SPKI PEM form
     * @returns {Promise<boolean>} true when the signature is genuine for the
     * key, false when it is not
     */
    verify(publicPem: string): Promise<boolean>;
    /**
     * Verifies the OWID signature against the supplied SPKI public key PEM,
     * offline, and reports the outcome as one of {@link FodId.SignatureStatus}
     * so that "could not check" stays apart from "does not match". Only
     * `SIGNATURE_INVALID` means the identifier should be distrusted.
     * @param {string} publicPem the creator public key in SPKI PEM form
     * @returns {Promise<{ok: boolean, status: string, message?: string,
     * cause?: any}>} a frozen result carrying `ok`, `status` and, where the
     * check could not be completed, a `message` and a `cause`
     */
    checkSignature(publicPem: string): Promise<{
        ok: boolean;
        status: string;
        message?: string;
        cause?: any;
    }>;
}
declare namespace FodId {
    export { FodIdParseResult };
}
/**
 * The answer from {@link FodId.tryParse} and {@link FodId.tryFromByteArray}.
 * Frozen. On success `ok` is true, `value` is the identifier and `status`
 * is `ParseStatus.PARSED`. On failure `ok` is false, `value` is null, never
 * a half read identifier, and `status` names the reason.
 */
type FodIdParseResult = {
    /**
     * whether the input was a structurally valid 51Did
     */
    ok: boolean;
    /**
     * the identifier on success, null on failure
     */
    value: FodId | null;
    /**
     * one of {@link FodId.ParseStatus}
     */
    status: string;
};
