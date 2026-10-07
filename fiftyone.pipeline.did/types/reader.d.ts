/**
 * What a 51Did says of itself, for code that has to decide where an
 * identifier may go and under which terms, and needs nothing else from
 * this package. It is the entry point for a web page, where every byte is
 * sent to every visitor, so it loads no OWID library, no key handling and
 * no client for the remote server.
 *
 * It answers with the same named values {@link FodId} does, read by the
 * same walk of the payload, so the two cannot disagree about an
 * identifier. It checks no signature and fetches nothing, so an identifier
 * it reads may still be a forgery, and code that has to know an identifier
 * is genuine uses {@link FodId} from the package entry point.
 */
export type FodIdFacts = {
    /**
     * whether the value is a structurally valid 51Did
     */
    ok: boolean;
    /**
     * one of {@link IdType}, null when not ok
     */
    type: number | null;
    /**
     * one of {@link Usage}, being the highest
     * usage granted, null when not ok
     */
    usage: number | null;
    /**
     * whether the issuer worked the
     * usage out from a signal other than the caller stating it, null when not
     * ok
     */
    usageIsIndirect: boolean | null;
    /**
     * the address of the terms document the
     * identifier was created under, null where it states none, where this
     * package does not know the document, and when not ok
     */
    terms: string | null;
};
/**
 * Reads the type, the usage and the terms of a 51Did. The value may be
 * anything at all, because a 51Did arrives from outside and failing to be
 * one is an ordinary outcome, so this never throws.
 * @param {*} value a 51Did in either base 64 alphabet
 * @returns {FodIdFacts} a frozen answer
 */
export function read(value: any): FodIdFacts;
import IdType = require("./idType");
import Usage = require("./usage");
export { IdType, Usage };
