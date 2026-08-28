export = FodId;
/**
 * A strongly typed reader for the 51Did (51Degrees Identifier) value returned
 * by the 51Degrees Cloud service.
 *
 * A 51Did is described at three levels. The 51Did is the identifier as a
 * whole. The envelope is the signed OWID that carries it (version, domain,
 * date, payload, signature), re-issued fresh on every call. The value is the
 * stable, comparable part of the payload after the Flags and License Id,
 * exposed via {@link FodId#hash}. Two 51Dids for the same inputs share the
 * same value even though their envelopes differ. Compare values, never
 * envelopes.
 *
 * The owid-js library is verify-only and exposes no instance asBase64, so this
 * type composes an owid instance (holds it and delegates) and keeps the
 * original base64 for {@link FodId#asBase64}. Construction does NOT verify the
 * signature; call {@link FodId#verify} (async) explicitly.
 */
declare class FodId {
    static FLAGS_OFFSET: number;
    static LICENSE_ID_OFFSET: number;
    static LICENSE_ID_LENGTH: number;
    static HASH_OFFSET: number;
    static HASH_LENGTH: number;
    static HEADER_LENGTH: number;
    static GUID_LENGTH: number;
    static RANDOM_PAYLOAD_LENGTH: number;
    static PAYLOAD_LENGTH: number;
    /**
     * Restores a base64 string in either alphabet to the standard alphabet
     * with padding, which is the only form the OWID library decodes. The
     * URL-safe characters `-` and `_` become `+` and `/`, then padding is
     * added where the length calls for it. A string already in the standard
     * form comes back unchanged.
     * @param {string} value base64 in the standard or URL-safe alphabet,
     * with or without padding
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
     * Parses a 51Did from its base64-encoded OWID string. Both base64
     * alphabets are accepted, the standard one the cloud issues and the
     * URL-safe one a page uses in a link, with or without padding. The
     * envelope is held in the standard form, so {@link FodId#asBase64}
     * returns the standard alphabet with padding whichever form was given.
     * @param {string} base64 the envelope in either base64 alphabet
     * @returns {FodId} the parsed identifier
     */
    static fromBase64(base64: string): FodId;
    /**
     * Parses a 51Did from the raw bytes of an OWID envelope.
     * @param {Uint8Array} buffer
     * @returns {FodId}
     */
    static fromByteArray(buffer: Uint8Array): FodId;
    /**
     * Promotes an already-parsed owid instance into a 51Did. The constructor
     * **copies** the owid (re-parsed from its base64), not aliases it, so a
     * FodId can never desync from its envelope if the caller later mutates the
     * owid it passed in.
     * @param {object} owidInstance
     * @returns {FodId}
     */
    static fromOwid(owidInstance: object): FodId;
    /**
     * Promotes an already-parsed owid instance into a 51Did by unpacking its
     * payload. The owid is **copied** (re-parsed from its base64), not aliased,
     * so a FodId can never desync from its envelope if the caller later mutates
     * the owid they passed in.
     * @param {object} owidInstance an owid instance (from `new owid(base64)`)
     */
    constructor(owidInstance: object);
    _owid: any;
    _flags: any;
    _licenseId: number;
    _hash: any;
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
     * @returns {Uint8Array} a defensive copy of the value bytes (a 32-byte
     * SHA-256, or 16 GUID bytes for Random) - the stable cache / dedup key.
     */
    get hash(): Uint8Array;
    /** @returns {number} the OWID version. */
    get version(): number;
    /** @returns {string} the domain of the OWID creator. */
    get domain(): string;
    /** @returns {number} the OWID date as minutes since 2020-01-01 UTC. */
    get date(): number;
    /**
     * The envelope's own date as the unsigned 32-bit count of minutes since
     * 2020-01-01T00:00:00Z, exactly as the wire carries it. This is the value
     * the OWID `public-key?date=` parameter takes, and the integer to use when
     * comparing creation times. The OWID library reads the field as a signed
     * 32-bit number, so this getter forces the unsigned reading.
     * @returns {number} minutes since 2020-01-01T00:00:00Z
     */
    get dateMinutes(): number;
    /** @returns {Uint8Array} the OWID payload bytes. */
    get payload(): Uint8Array;
    /** @returns {Uint8Array} the 64-byte OWID signature. */
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
     * Verifies the OWID signature against the supplied SPKI public key PEM. This
     * is an explicit, separate step - construction never verifies. Asynchronous
     * because it uses Web Crypto.
     * @param {string} publicPem the creator public key in SPKI PEM form
     * @returns {Promise<boolean>}
     */
    verify(publicPem: string): Promise<boolean>;
}
