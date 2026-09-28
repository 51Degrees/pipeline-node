/**
 * A function with the shape of the global `fetch`, taking a URL and an
 * options object with `method`, `headers` and `body`, and resolving to a
 * response with `status` and a `text()` method. Node 18 and later and
 * browsers provide it globally, and tests inject one.
 */
export type FetchFunction = (url: string, init: object) => Promise<{
    status: number;
    text: () => Promise<string>;
}>;
/**
 * A published signing key and the moment it came into force. A key stays in
 * force until its `endsAt`, or until the next key starts where the entry
 * carries no `endsAt`.
 */
export type PublicKeyEntry = {
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
/**
 * The detailed answer to an offline signature check.
 */
export type SignatureCheck = {
    /**
     * whether a candidate key verified the signature
     */
    valid: boolean;
    /**
     * one of {@link SignatureReason}
     */
    reason: string;
};
/**
 * Options for {@link DidClient}.
 */
export type DidClientOptions = {
    /**
     * the page's resource key. Required. Public
     * by nature, it travels in the route of the key and verify requests and in
     * the form body of the redeem request.
     */
    resourceKey: string;
    /**
     * a licence key of the same account. Server
     * side only. Needed to redeem where the account holds licence keys, and
     * sent only in the body of the redeem request, never in a URL.
     */
    licenceKey?: string;
    /**
     * the API base including the `/api/v4/`
     * segment. Defaults to the FOD_CLOUD_API_URL environment variable where
     * the runtime has environment variables, then to the public cloud. A value
     * without a trailing slash gains one.
     */
    endpoint?: string;
    /**
     * the HTTP transport. Defaults to the
     * global `fetch`, on Node and in a browser alike.
     */
    fetch?: FetchFunction;
    /**
     * the clock, as milliseconds since the
     * Unix epoch. Defaults to `Date.now`. Tests inject one.
     */
    now?: () => number;
};
/**
 * A function with the shape of the global `fetch`, taking a URL and an
 * options object with `method`, `headers` and `body`, and resolving to a
 * response with `status` and a `text()` method. Node 18 and later and
 * browsers provide it globally, and tests inject one.
 * @callback FetchFunction
 * @param {string} url the absolute URL to request
 * @param {object} init the request options
 * @returns {Promise<{status: number, text: function(): Promise<string>}>}
 * the response
 */
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
 * The detailed answer to an offline signature check.
 * @typedef {object} SignatureCheck
 * @property {boolean} valid whether a candidate key verified the signature
 * @property {string} reason one of {@link SignatureReason}
 */
/**
 * Options for {@link DidClient}.
 * @typedef {object} DidClientOptions
 * @property {string} resourceKey the page's resource key. Required. Public
 * by nature, it travels in the route of the key and verify requests and in
 * the form body of the redeem request.
 * @property {string} [licenceKey] a licence key of the same account. Server
 * side only. Needed to redeem where the account holds licence keys, and
 * sent only in the body of the redeem request, never in a URL.
 * @property {string} [endpoint] the API base including the `/api/v4/`
 * segment. Defaults to the FOD_CLOUD_API_URL environment variable where
 * the runtime has environment variables, then to the public cloud. A value
 * without a trailing slash gains one.
 * @property {FetchFunction} [fetch] the HTTP transport. Defaults to the
 * global `fetch`, on Node and in a browser alike.
 * @property {function(): number} [now] the clock, as milliseconds since the
 * Unix epoch. Defaults to `Date.now`. Tests inject one.
 */
/**
 * Everything a server does with a 51Did against the 51Degrees cloud: fetch
 * the signing public keys and pick the one in force when an identifier was
 * created, verify a signature offline against it, verify a signature
 * through the cloud, and redeem a sealed creator context result with the
 * licence key.
 *
 * Creating a 51Did is not part of this client. Creation is the cloud `json`
 * endpoint through the cloud request engine and pipeline, and a page
 * creates from the browser because the identifier describes the browser's
 * own connection. The verify-context and verify-full endpoints are browser
 * calls for the same reason and are not offered here.
 *
 * The public key list is cached per instance with the time it was fetched.
 * One instance can serve a whole server. A page builds a new instance on
 * each view, and there the browser's HTTP cache can answer the key request
 * again for as long as the cloud's `Cache-Control` header allows.
 */
export class DidClient {
    /**
     * @param {DidClientOptions} options the resource key, and optionally the
     * licence key, endpoint, transport and clock
     */
    constructor(options: DidClientOptions);
    _resourceKey: string;
    _licenceKey: string;
    _endpoint: string;
    /**
     * The transport, called as a plain function and never as a method of
     * the client, because a browser's fetch refuses to run as a method of
     * anything but the window.
     * @type {FetchFunction}
     */
    _fetch: FetchFunction;
    _now: () => number;
    /** @type {PublicKeyEntry[] | null} */
    _keys: PublicKeyEntry[] | null;
    /** @type {number | null} when the whole list was last fetched */
    _fetchedAt: number | null;
    /** @type {number | null} when the last limited fetch started */
    _refetchedAt: number | null;
    /** @type {Promise<PublicKeyEntry[]> | null} */
    _pending: Promise<PublicKeyEntry[]> | null;
    /** @returns {string} the API base every request is built on */
    get endpoint(): string;
    /** @returns {string} the resource key the requests carry */
    get resourceKey(): string;
    /**
     * The published signing keys, oldest first. The whole list is fetched on
     * first use and again once it is a day old. The cloud publishes a key
     * only from shortly before its period starts, so the keys from the newest
     * start held onwards are also fetched when an identifier's date reaches
     * the end of the list held (see {@link DidClient#publicKeyFor}). Every
     * answer is merged in by start, so no older key is dropped.
     * @returns {Promise<PublicKeyEntry[]>} the keys, oldest start first
     */
    publicKeys(): Promise<PublicKeyEntry[]>;
    /**
     * The key in force when the identifier was created, being the entry whose
     * start is latest on or before the identifier's date, unless that entry
     * has ended. Before answering, the whole list is fetched when it is more
     * than a day old, or else the keys from the newest start held onwards
     * when {@link PublicKeys.covers} says the list does not answer for the
     * date, at most once a minute.
     * @param {FodId | string} fodId the identifier, or its base64
     * @returns {Promise<PublicKeyEntry | null>} the key, or null when no key
     * held covers the date
     */
    publicKeyFor(fodId: FodId | string): Promise<PublicKeyEntry | null>;
    /**
     * Verifies the identifier's signature offline against the published keys,
     * as the cloud's own verify endpoint does. The envelope version must be
     * the one the cloud signs, the payload must be at least the base length
     * for its type (a longer payload carries a creator context and is
     * accepted), and the signature must verify against the key in force at
     * the identifier's date or, near a period boundary, the neighbouring key.
     * No earlier key is tried. Keys are fetched as
     * {@link DidClient#publicKeyFor} says. A key can be replaced before its
     * `endsAt`, so where no key held verifies the signature and nothing was
     * fetched for this check, the keys from the start of the one in force at
     * the identifier's date onwards are fetched, at most once a minute, and
     * the check made once more.
     * @param {FodId | string} fodId the identifier, or its base64
     * @returns {Promise<boolean>} true when a candidate key verifies it
     */
    verifySignature(fodId: FodId | string): Promise<boolean>;
    /**
     * As {@link DidClient#verifySignature}, with the reason alongside the
     * answer, so a caller can tell an identifier no key covers from one whose
     * signature failed.
     * @param {FodId | string} fodId the identifier, or its base64
     * @returns {Promise<SignatureCheck>} the answer and its reason
     */
    verifySignatureDetailed(fodId: FodId | string): Promise<SignatureCheck>;
    /**
     * Verifies the identifier's signature through the cloud's verify
     * endpoint, the open endpoint that needs no licence key. One use against
     * the resource key. The identifier is sent under both parameter names,
     * `51did` and `owid`, so the request works with hosts that read either
     * parameter. Hosts that recognise both prefer `51did` and keep `owid` as
     * a compatibility alias.
     * @param {FodId | string} fodId the identifier, or its base64 in either
     * alphabet
     * @returns {Promise<boolean>} whether the cloud found the signature valid
     * @throws {DidArgumentError} when the value is not a 51Did, refused here
     * with the reader's status before any request is made, or when the cloud
     * refuses it (HTTP 400), with the cloud's message
     * @throws {DidClientError} on any other answer than valid or invalid
     */
    verify(fodId: FodId | string): Promise<boolean>;
    /**
     * Redeems a sealed creator context result against the identifier, on the
     * server, with the licence key. The resource key, the 51Did, the sealed
     * result, the challenge and the licence key all travel in the body of a
     * POST to id/redeem, so none of them reaches an access log. (The redeem
     * endpoint takes the resource key in the form on a POST, where the key
     * and verify endpoints take it in the route on a GET.) One use against
     * the resource key, the second of the two a browser context check costs.
     *
     * A 200 and a 503 both produce a result, the 503 being the `unconfirmed`
     * outcome the caller may retry. Every cryptographic failure comes back as
     * the one word `unreadable` by design, so the client does not try to
     * tell them apart either.
     * @param {FodId | string} fodId the identifier the caller knows
     * independently, or its base64 in either alphabet
     * @param {string} result the sealed result exactly as the verify endpoint
     * returned it to the page
     * @param {string} [challenge] the single-use challenge given to the
     * verify endpoint, where one was
     * @returns {Promise<RedeemResult>} the typed outcome
     * @throws {DidArgumentError} when the value is not a 51Did, refused here
     * with the reader's status before any request is made, or when the cloud
     * refuses it (HTTP 400), with the cloud's message
     * @throws {DidNotSupportedError} when the host does not offer the creator
     * context (HTTP 404)
     * @throws {DidClientError} on any other status
     */
    redeem(fodId: FodId | string, result: string, challenge?: string): Promise<RedeemResult>;
    /**
     * The key list to select from for the given date, after the fetch
     * {@link DidClient#_fetchFor} calls for, where it calls for one.
     * @param {Date} date the identifier's date
     * @returns {Promise<PublicKeyEntry[]>} the keys to select from
     * @private
     */
    private _keysFor;
    /**
     * The fetch a question about the date needs first, or null where the list
     * held answers it. With nothing held, or a list more than a day old, that
     * is the whole list. Where {@link PublicKeys.covers} says the list does
     * not answer for the date, it is the keys from the newest start held
     * onwards, within the limit {@link DidClient#_refetch} applies.
     * @param {Date} date the identifier's date
     * @returns {Promise<PublicKeyEntry[]> | null} the fetch, or null
     * @private
     */
    private _fetchFor;
    /**
     * A fetch of the keys from the given start onwards, made because the list
     * held may lack a key a check needs. It shares a fetch already under way,
     * and otherwise starts at most once a minute, answering null where that
     * limit stops it.
     * @param {Date | null} since the start to fetch from, or null for the
     * whole list
     * @returns {Promise<PublicKeyEntry[]> | null} the fetch, or null
     * @private
     */
    private _refetch;
    /**
     * @returns {boolean} whether the list is missing or the whole list was
     * last fetched over a day ago
     * @private
     */
    private _stale;
    /**
     * Fetches keys and merges the answer into the list held, sharing one
     * request between concurrent callers. Only a fetch of the whole list
     * resets the list's age.
     * @param {Date | null} since the start to fetch from, or null for the
     * whole list
     * @returns {Promise<PublicKeyEntry[]>} the list held after the merge
     * @private
     */
    private _refresh;
    /**
     * GET id/key/{resource} and read each entry through
     * {@link PublicKeys.fromList}, so `startsAt` is read where present and
     * `created` otherwise, `endsAt` is kept, and `weekStart` is ignored. A
     * start given is sent as `datetime`, so the cloud answers with the keys
     * that start then or later only.
     * @param {Date | null} since the start to fetch from, or null for the
     * whole list
     * @returns {Promise<PublicKeyEntry[]>} the answer, oldest start first
     * @private
     */
    private _fetchKeys;
}
/**
 * The typed answer to a redemption. Built from the cloud's JSON body, with
 * the raw status and body kept for logging.
 */
export class RedeemResult {
    /**
     * Builds a result from a redeem response body.
     * @param {number} statusCode the HTTP status
     * @param {string} raw the response body
     * @returns {RedeemResult} the typed result
     */
    static fromResponse(statusCode: number, raw: string): RedeemResult;
    /**
     * Reads the typed fields out of the parsed body.
     * @param {number} statusCode the HTTP status, 200 or 503
     * @param {string} raw the response body as received
     * @param {object} parsed the body parsed as JSON
     */
    constructor(statusCode: number, raw: string, parsed: object);
    /** @type {number} the HTTP status the cloud answered with */
    statusCode: number;
    /** @type {string} the response body exactly as received */
    raw: string;
    /**
     * @type {string} the `context` string exactly as the cloud sent it,
     * kept so an outcome this package does not know is still visible
     */
    contextRaw: string;
    /**
     * @type {string} one of {@link ContextResult}. A string this package
     * does not know maps to `unreadable`, so an unrecognised outcome is
     * never mistaken for a good one.
     */
    context: string;
    /** @type {string} one of {@link SignatureResult} */
    signature: string;
    /**
     * @type {object | undefined} {@link Factor} name to
     * {@link FactorResult} value (or null where nothing was compared),
     * present only when the cloud sent `factors`, which it does where there
     * is something to diagnose, being a mismatch or a misconfigured result
     * that still compared some factors. Every name is kept exactly as the
     * cloud sent it, including one this package does not list in
     * {@link Factor}, so a factor the cloud adds later reaches the caller
     * without a new release of this package.
     */
    factors: object | undefined;
    /**
     * @type {Date | undefined} when the verify endpoint checked the context
     * and sealed the result, present on the redeemed and expired outcomes
     */
    verifiedAt: Date | undefined;
    /**
     * @type {number | undefined} whole seconds between the sealing and this
     * redemption by the cloud's clock, present on the redeemed and expired
     * outcomes
     */
    secondsSinceVerified: number | undefined;
    /**
     * The result in the cloud's own response shape (`signature`, `context`,
     * `factors` when present, `verifiedAt`, `secondsSinceVerified`), so a
     * server can answer a page with it directly. `signature` is left out when
     * the cloud did not report it, as the cloud leaves it out.
     * @returns {object} the plain object for JSON.stringify
     */
    toJSON(): object;
}
/**
 * The creator context outcome of a redemption, as the cloud reports it in
 * the `context` field. The values are the cloud's own strings, so a result
 * can be compared to a constant or printed as received.
 */
export const ContextResult: Readonly<{
    /** Every factor matched the browser and connection that created it. */
    VERIFIED: "verified";
    /** At least one factor differed. `factors` says which. */
    MISMATCH: "mismatch";
    /** The identifier carries no creator context. */
    NO_CONTEXT: "nocontext";
    /** The service holds no secret covering the identifier's date. */
    NOT_CHECKABLE: "notcheckable";
    /**
     * The service that checked the identifier could not complete the check,
     * and the reason is that service rather than the identifier. It either
     * compared nothing, or compared some factors and reports at least one as
     * `misconfigured` in `factors`. Nothing a caller sends can produce it.
     */
    MISCONFIGURED: "misconfigured";
    /**
     * The creation date is one the scheme could not have produced, being in
     * the future or before the creator context scheme began, so the
     * identifier is fabricated rather than the service being wrong.
     */
    INVALID_DATE: "invaliddate";
    /** The sealed result was redeemed outside the freshness window. */
    EXPIRED: "expired";
    /** The sealed result had already been redeemed on that instance. */
    REPLAYED: "replayed";
    /**
     * The sealed result could not be read. Every cryptographic failure, a
     * missing licence key included, comes back as this one word by design,
     * and a context string this package does not know is mapped here too.
     */
    UNREADABLE: "unreadable";
    /** First use could not be confirmed (503). The caller may retry. */
    UNCONFIRMED: "unconfirmed";
}>;
/**
 * The signature outcome of a redemption, as the cloud reports it in the
 * `signature` field of a redeemed result. Absent on every other outcome.
 */
export const SignatureResult: Readonly<{
    VERIFIED: "verified";
    INVALID: "invalid";
    /** The cloud did not report the signature, as on an expired result. */
    UNKNOWN: "unknown";
}>;
/**
 * The outcome of one factor in a mismatch. The cloud reports `null` for a
 * factor that was not compared, which is passed through unchanged.
 */
export const FactorResult: Readonly<{
    VERIFIED: "verified";
    MISMATCH: "mismatch";
    /**
     * The service that checked the identifier is not configured to determine
     * this factor, so it could not have checked it for any request. This is
     * NOT a mismatch and must not be read as one.
     */
    MISCONFIGURED: "misconfigured";
}>;
/**
 * The names of the creator context factors, as the cloud writes them as
 * keys of `factors`, in the order the cloud lists them. The operating
 * system and the browser each have a name and a version, so a version
 * mismatch beside a verified name reads as an upgrade, and a mismatched
 * name reads as a different operating system or browser. These four
 * replaced the single `browser` factor from cloud release 4.4.38.
 * {@link RedeemResult#factors} is not limited to these names, so a factor
 * the cloud adds later still reaches the caller.
 */
export const Factor: Readonly<{
    TRANSPORT: "transport";
    DEVICE: "device";
    BROWSER_IP: "browserip";
    CONNECTION_IP: "connectionip";
    ASN: "asn";
    PLATFORM_NAME: "platformname";
    PLATFORM_VERSION: "platformversion";
    BROWSER_NAME: "browsername";
    BROWSER_VERSION: "browserversion";
}>;
/**
 * The reason a {@link DidClient#verifySignatureDetailed} answer was given.
 */
export const SignatureReason: Readonly<{
    /** A candidate key verified the signature. */
    VERIFIED: "verified";
    /** The envelope version is not the one the cloud signs. */
    VERSION: "version";
    /** The payload is shorter than the base length for its type. */
    LENGTH: "length";
    /** No published key covers the identifier's date. */
    NO_KEY: "nokey";
    /** Every candidate key was tried and none verified the signature. */
    SIGNATURE: "signature";
}>;
/**
 * An answer from the cloud that was not the one asked for. Carries the HTTP
 * status and the response body so a caller can relay or log what the cloud
 * said.
 */
export class DidClientError extends Error {
    /**
     * Builds the error with the status and body the cloud answered.
     * @param {string} message what went wrong
     * @param {number} [statusCode] the HTTP status, where there was one
     * @param {string} [body] the response body, where there was one
     */
    constructor(message: string, statusCode?: number, body?: string);
    statusCode: number;
    body: string;
}
/**
 * The 51Did argument is invalid, either when checked locally or refused by
 * the cloud (HTTP 400 with an `errors` list).
 */
export class DidArgumentError extends DidClientError {
}
/**
 * The host answering does not offer the creator context (HTTP 404 from the
 * redeem endpoint). A caller can name this case rather than treat it as a
 * failed check.
 */
export class DidNotSupportedError extends DidClientError {
}
/**
 * The public cloud API base, used when neither the endpoint option nor the
 * FOD_CLOUD_API_URL environment variable is set.
 */
export const DEFAULT_ENDPOINT: "https://cloud.51degrees.com/api/v4/";
import FodId = require("./fodId");
