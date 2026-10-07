/**
 * Why a walk of a 51Did payload succeeded or failed. PARSED carries the
 * same value the OWID library gives a successful read of an envelope, so
 * that one status says the whole identifier was read, and the others are
 * the outcomes that belong to the payload rather than to the envelope.
 * Frozen, and compared by value rather than by the text of any message.
 *
 * This module is internal to the package, and both readers of a 51Did
 * walk the payload through it, so the layout is read in one place.
 */
export const PayloadStatus: Readonly<{
    /** The payload holds a structurally valid 51Did. */
    PARSED: "Parsed";
    /**
     * The payload is shorter than the five byte header (one byte of flags
     * and four bytes of licence id), so not even the identifier type can be
     * read.
     */
    PAYLOAD_TOO_SHORT: "PayloadTooShort";
    /**
     * The header was read and named a type, and the payload is shorter than
     * the match key that type carries after the header (16 GUID bytes for
     * Random, 32 hash bytes for Probabilistic and HashedEmail).
     */
    INVALID_TYPE_PAYLOAD_LENGTH: "InvalidTypePayloadLength";
    /**
     * Bits 4 and 5 of the flags byte name a payload layout version this
     * package does not know, so no field is read. A later version exists
     * precisely because a field moved, so reading the payload under the
     * layout this package knows would answer with values that are wrong
     * rather than absent.
     */
    UNSUPPORTED_PAYLOAD_VERSION: "UnsupportedPayloadVersion";
    /**
     * Bits 0 to 2 of the flags byte are all clear, which is not a usage. The
     * cloud writes no flags byte without bit 0, so such a payload is damaged
     * or forged, and it is refused rather than offered as a fourth usage.
     */
    NO_USAGE: "NoUsage";
}>;
/**
 * Reads the 51Did fields out of an envelope payload, answering with a
 * status rather than throwing. This is the one walk of the payload, shared
 * by every surface that reads a 51Did. The type is read from the header and
 * decides the least the payload must hold after the header. The terms byte
 * follows the match key, and anything beyond the terms byte is a creator
 * context section whose lengths belong to the cloud, so a longer payload is
 * accepted whatever its length.
 * @param {Uint8Array} payload the payload bytes
 * @returns {{status: string, flags?: number, licenseId?: number,
 * matchKey?: Uint8Array, termsIndex?: number, length: number,
 * required: number, type?: number, payloadVersion?: number,
 * usageBits?: number}} `status` PARSED with the fields, or a 51Did status
 * with the length the type needed, and the version or the usage bits found
 * where that is what the payload was refused for
 */
export function unpack(payload: Uint8Array): {
    status: string;
    flags?: number;
    licenseId?: number;
    matchKey?: Uint8Array;
    termsIndex?: number;
    length: number;
    required: number;
    type?: number;
    payloadVersion?: number;
    usageBits?: number;
};
