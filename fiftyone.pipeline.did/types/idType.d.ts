export = IdType;
/**
 * The identifier type carried in bits 6-7 of the 51Did flags byte. Existing
 * identifiers were issued with these bits zeroed, so they decode as
 * PROBABILISTIC. The type selects the length of the value that follows the
 * header in the payload.
 */
declare const IdType: Readonly<{
    /** Device fingerprint + IP. Payload carries a 32-byte SHA-256 value. */
    PROBABILISTIC: 0;
    /** Server-generated random GUID. Payload carries 16 GUID bytes. */
    RANDOM: 1;
    /** Caller email + salt. Payload carries a 32-byte SHA-256 value. */
    HASHED_EMAIL: 2;
    /** Not yet assigned. Parsed best-effort; remaining bytes exposed as-is. */
    RESERVED: 3;
    /**
     * Decodes the identifier type from the top two bits (6-7) of a flags byte.
     * @param {number} flags the 1-byte flags value (0-255)
     * @returns {number} the IdType value
     */
    fromFlags(flags: number): number;
    /**
     * The human-readable name of an IdType value.
     * @param {number} type an IdType value, being 0 to 3 as fromFlags returns
     * @returns {string} the name of that type, for example "Probabilistic"
     */
    name(type: number): string;
}>;
