export = Terms;
declare const Terms: Readonly<{
    /**
     * An index this package does not know, being one added to the table
     * after this package was released. Not the same value as NOT_STATED,
     * because terms are stated and this package cannot name them. Read the
     * index itself from termsIndex.
     */
    UNKNOWN: -1;
    /**
     * The terms are not stated in the identifier, which is also how an
     * identifier issued before the byte existed reads. The answer has to
     * come from the data accompanying the identifier.
     */
    NOT_STATED: 0;
    /** The Model Terms for Marketing, version 2, at https://m4ow.uk/mtm/2.txt. */
    MODEL_TERMS_FOR_MARKETING_2: 1;
    /**
     * The Terms value for a raw index byte, being UNKNOWN for every index
     * this package does not know.
     * @param {number} index the 1-byte terms index (0-255)
     * @returns {number} the Terms value
     */
    fromIndex(index: number): number;
    /**
     * The cross language name of a Terms value.
     * @param {number} terms a Terms value
     * @returns {string} for example "ModelTermsForMarketing2"
     */
    name(terms: number): string;
    /**
     * The address of the terms document a Terms value stands for, or null
     * for NOT_STATED and for UNKNOWN. Never an empty string, and never an
     * address built from the index. The address is returned and never
     * fetched.
     * @param {number} terms a Terms value
     * @returns {string|null} for example "https://m4ow.uk/mtm/2.txt"
     */
    url(terms: number): string | null;
}>;
