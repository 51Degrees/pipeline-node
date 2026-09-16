export = Usage;
declare const Usage: Readonly<{
    /** Created for use that is not marketing. Must not be passed to a demand source. */
    NON_MARKETING: 1;
    /** Created for standard marketing, being targeting unrelated to browsing history. */
    STANDARD: 2;
    /** Created for personalized marketing, being targeting related to browsing history. */
    PERSONALIZED: 3;
    /**
     * Decodes the usage from bits 0-2 of a flags byte, as the highest usage
     * granted. There is no Usage for bits 000, because the cloud never
     * writes a flags byte without bit 0, so a payload carrying 000 is
     * damaged or forged and FodId refuses it with
     * `FodId.ParseStatus.NO_USAGE` before this is asked.
     * @param {number} flags the 1-byte flags value (0-255)
     * @returns {number} the Usage value
     * @throws {RangeError} when bits 0-2 are all clear
     */
    fromFlags(flags: number): number;
    /**
     * The cross language name of a Usage value.
     * @param {number} usage a Usage value, 1 to 3
     * @returns {string|null} for example "NonMarketing", or null for a value
     * that is not a Usage
     */
    name(usage: number): string | null;
    /**
     * The cloud's id.usage value for a Usage value.
     * @param {number} usage a Usage value, 1 to 3
     * @returns {string|null} for example "non-marketing", or null for a value
     * that is not a Usage
     */
    idUsage(usage: number): string | null;
}>;
