declare const _exports: Readonly<{
    /** Byte offset of the flags byte within the payload. */
    FLAGS_OFFSET: 0;
    /** Byte offset of the licence id field within the payload. */
    LICENSE_ID_OFFSET: 1;
    /** Byte length of the licence id field. */
    LICENSE_ID_LENGTH: 4;
    /** Byte offset of the match key field within the payload. */
    MATCH_KEY_OFFSET: 5;
    /**
     * Byte length of the match key field for Probabilistic and HashedEmail
     * identifiers, being a SHA-256.
     */
    MATCH_KEY_LENGTH: 32;
    /**
     * Byte length of the terms field, which follows the match key. Its
     * offset is not a constant here, because the match key length depends on
     * the identifier type, so the offset is worked out from the type. A
     * payload that ends at the match key carries no terms byte and reads as
     * a terms index of zero, so the least payload lengths below do not
     * include it.
     */
    TERMS_LENGTH: 1;
    /** Byte length of the flags and licence id fields together. */
    HEADER_LENGTH: 5;
    /** Byte length of the GUID match key carried by Random identifiers. */
    GUID_LENGTH: 16;
    /**
     * The payload layout version this package reads, carried in bits 4 and
     * 5 of the flags byte. Any other version is refused rather than read
     * under this layout.
     */
    SUPPORTED_PAYLOAD_VERSION: 0;
    /** Least payload length for a Random identifier. */
    RANDOM_PAYLOAD_LENGTH: 21;
    /**
     * Least payload length for a Probabilistic or HashedEmail identifier.
     */
    PAYLOAD_LENGTH: 37;
}>;
export = _exports;
