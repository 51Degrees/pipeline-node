export = Usage;
declare const Usage: Readonly<{
    /**
     * No usage bit is set. The cloud never issues such an identifier, so
     * this is an identifier from somewhere else or a damaged one, and it
     * should be treated as though it may not be passed on.
     */
    NONE: 0;
    /** Created for use that is not marketing. Must not be passed to a demand source. */
    NON_MARKETING: 1;
    /** Created for standard marketing, being targeting unrelated to browsing history. */
    STANDARD: 2;
    /** Created for personalized marketing, being targeting related to browsing history. */
    PERSONALIZED: 3;
    /**
     * Decodes the usage from bits 0-2 of a flags byte, as the highest usage
     * granted.
     * @param {number} flags the 1-byte flags value (0-255)
     * @returns {number} the Usage value
     */
    fromFlags(flags: number): number;
    /**
     * The cross language name of a Usage value.
     * @param {number} usage a Usage value, 0 to 3
     * @returns {string} for example "NonMarketing"
     */
    name(usage: number): string;
    /**
     * The cloud's id.usage value for a Usage value, or null for NONE.
     * @param {number} usage a Usage value, 0 to 3
     * @returns {string|null} for example "non-marketing"
     */
    idUsage(usage: number): string | null;
}>;
