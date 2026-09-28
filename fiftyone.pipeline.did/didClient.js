/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

const FodId = require('./fodId');
const layout = require('./internal/layout');
const IdType = require('./idType');
const PublicKeys = require('./publicKeys');
const packageVersion = require('./package.json').version;

/**
 * The public cloud API base, used when neither the endpoint option nor the
 * FOD_CLOUD_API_URL environment variable is set.
 */
const DEFAULT_ENDPOINT = 'https://cloud.51degrees.com/api/v4/';

/**
 * Sent with every request on Node so the cloud can tell which package
 * called. See {@link requestHeaders} for why a browser does not send it.
 */
const USER_AGENT = 'fiftyone.pipeline.did/' + packageVersion;

const MINUTE_MS = 60 * 1000;

/**
 * The whole key list is fetched again before use once it is older than
 * this, which bounds how long a key replaced before its `endsAt` is still
 * trusted.
 */
const KEY_LIST_MAX_AGE_MS = 24 * 60 * MINUTE_MS;

/**
 * The shortest gap between fetches made because the list held does not
 * cover an identifier's date or a signature failed with every key held, so
 * an identifier dated where no key is published yet cannot make every
 * check call the cloud. Fetches of the whole list are not counted.
 */
const REFETCH_INTERVAL_MS = MINUTE_MS;

/** The only envelope version the cloud signs and verifies. */
const SUPPORTED_VERSION = 3;

/**
 * The longest encoded identifier the client will look at. The figure is
 * arbitrary and deliberately generous, far above anything the cloud issues,
 * because its only job is to turn obviously malformed input away before the
 * client decodes it, fetches a key or calls the cloud. It says nothing about
 * how long a 51Did is, and a value under it is still left to the cloud to
 * judge.
 */
const MAXIMUM_ENCODED_LENGTH = 4096;

/**
 * The creator context outcome of a redemption, as the cloud reports it in
 * the `context` field. The values are the cloud's own strings, so a result
 * can be compared to a constant or printed as received.
 */
const ContextResult = Object.freeze({
  /** Every factor matched the browser and connection that created it. */
  VERIFIED: 'verified',
  /** At least one factor differed. `factors` says which. */
  MISMATCH: 'mismatch',
  /** The identifier carries no creator context. */
  NO_CONTEXT: 'nocontext',
  /** The service holds no secret covering the identifier's date. */
  NOT_CHECKABLE: 'notcheckable',
  /**
   * The service that checked the identifier could not complete the check,
   * and the reason is that service rather than the identifier. It either
   * compared nothing, or compared some factors and reports at least one as
   * `misconfigured` in `factors`. Nothing a caller sends can produce it.
   */
  MISCONFIGURED: 'misconfigured',
  /**
   * The creation date is one the scheme could not have produced, being in
   * the future or before the creator context scheme began, so the
   * identifier is fabricated rather than the service being wrong.
   */
  INVALID_DATE: 'invaliddate',
  /** The sealed result was redeemed outside the freshness window. */
  EXPIRED: 'expired',
  /** The sealed result had already been redeemed on that instance. */
  REPLAYED: 'replayed',
  /**
   * The sealed result could not be read. Every cryptographic failure, a
   * missing licence key included, comes back as this one word by design,
   * and a context string this package does not know is mapped here too.
   */
  UNREADABLE: 'unreadable',
  /** First use could not be confirmed (503). The caller may retry. */
  UNCONFIRMED: 'unconfirmed'
});

const KNOWN_CONTEXTS = new Set(Object.values(ContextResult));

/**
 * The signature outcome of a redemption, as the cloud reports it in the
 * `signature` field of a redeemed result. Absent on every other outcome.
 */
const SignatureResult = Object.freeze({
  VERIFIED: 'verified',
  INVALID: 'invalid',
  /** The cloud did not report the signature, as on an expired result. */
  UNKNOWN: 'unknown'
});

/**
 * The outcome of one factor in a mismatch. The cloud reports `null` for a
 * factor that was not compared, which is passed through unchanged.
 */
const FactorResult = Object.freeze({
  VERIFIED: 'verified',
  MISMATCH: 'mismatch',
  /**
   * The service that checked the identifier is not configured to determine
   * this factor, so it could not have checked it for any request. This is
   * NOT a mismatch and must not be read as one.
   */
  MISCONFIGURED: 'misconfigured'
});

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
const Factor = Object.freeze({
  TRANSPORT: 'transport',
  DEVICE: 'device',
  BROWSER_IP: 'browserip',
  CONNECTION_IP: 'connectionip',
  ASN: 'asn',
  PLATFORM_NAME: 'platformname',
  PLATFORM_VERSION: 'platformversion',
  BROWSER_NAME: 'browsername',
  BROWSER_VERSION: 'browserversion'
});

/**
 * The reason a {@link DidClient#verifySignatureDetailed} answer was given.
 */
const SignatureReason = Object.freeze({
  /** A candidate key verified the signature. */
  VERIFIED: 'verified',
  /** The envelope version is not the one the cloud signs. */
  VERSION: 'version',
  /** The payload is shorter than the base length for its type. */
  LENGTH: 'length',
  /** No published key covers the identifier's date. */
  NO_KEY: 'nokey',
  /** Every candidate key was tried and none verified the signature. */
  SIGNATURE: 'signature'
});

/**
 * An answer from the cloud that was not the one asked for. Carries the HTTP
 * status and the response body so a caller can relay or log what the cloud
 * said.
 */
class DidClientError extends Error {
  /**
   * Builds the error with the status and body the cloud answered.
   * @param {string} message what went wrong
   * @param {number} [statusCode] the HTTP status, where there was one
   * @param {string} [body] the response body, where there was one
   */
  constructor (message, statusCode, body) {
    super(message);
    this.name = 'DidClientError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

/**
 * The 51Did argument is invalid, either when checked locally or refused by
 * the cloud (HTTP 400 with an `errors` list).
 */
class DidArgumentError extends DidClientError {
  /**
   * Builds the error from the validation message.
   * @param {string} message the validation message
   * @param {number} [statusCode] the HTTP status
   * @param {string} [body] the response body
   */
  constructor (message, statusCode, body) {
    super(message, statusCode, body);
    this.name = 'DidArgumentError';
  }
}

/**
 * The host answering does not offer the creator context (HTTP 404 from the
 * redeem endpoint). A caller can name this case rather than treat it as a
 * failed check.
 */
class DidNotSupportedError extends DidClientError {
  /**
   * Builds the error from what the host said.
   * @param {string} message what the host said
   * @param {number} [statusCode] the HTTP status
   * @param {string} [body] the response body
   */
  constructor (message, statusCode, body) {
    super(message, statusCode, body);
    this.name = 'DidNotSupportedError';
  }
}

/**
 * The typed answer to a redemption. Built from the cloud's JSON body, with
 * the raw status and body kept for logging.
 */
class RedeemResult {
  /**
   * Reads the typed fields out of the parsed body.
   * @param {number} statusCode the HTTP status, 200 or 503
   * @param {string} raw the response body as received
   * @param {object} parsed the body parsed as JSON
   */
  constructor (statusCode, raw, parsed) {
    /** @type {number} the HTTP status the cloud answered with */
    this.statusCode = statusCode;
    /** @type {string} the response body exactly as received */
    this.raw = raw;
    const context = typeof parsed.context === 'string' ? parsed.context : '';
    /**
     * @type {string} the `context` string exactly as the cloud sent it,
     * kept so an outcome this package does not know is still visible
     */
    this.contextRaw = context;
    /**
     * @type {string} one of {@link ContextResult}. A string this package
     * does not know maps to `unreadable`, so an unrecognised outcome is
     * never mistaken for a good one.
     */
    this.context = KNOWN_CONTEXTS.has(context)
      ? context
      : ContextResult.UNREADABLE;
    /** @type {string} one of {@link SignatureResult} */
    this.signature = parsed.signature === SignatureResult.VERIFIED
      ? SignatureResult.VERIFIED
      : parsed.signature === SignatureResult.INVALID
        ? SignatureResult.INVALID
        : SignatureResult.UNKNOWN;
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
    this.factors = parsed.factors && typeof parsed.factors === 'object'
      ? Object.freeze(Object.assign({}, parsed.factors))
      : undefined;
    const verifiedAt = typeof parsed.verifiedAt === 'string'
      ? new Date(parsed.verifiedAt)
      : null;
    /**
     * @type {Date | undefined} when the verify endpoint checked the context
     * and sealed the result, present on the redeemed and expired outcomes
     */
    this.verifiedAt = verifiedAt && !isNaN(verifiedAt.getTime())
      ? verifiedAt
      : undefined;
    /**
     * @type {number | undefined} whole seconds between the sealing and this
     * redemption by the cloud's clock, present on the redeemed and expired
     * outcomes
     */
    this.secondsSinceVerified = Number.isFinite(parsed.secondsSinceVerified)
      ? parsed.secondsSinceVerified
      : undefined;
  }

  /**
   * Builds a result from a redeem response body.
   * @param {number} statusCode the HTTP status
   * @param {string} raw the response body
   * @returns {RedeemResult} the typed result
   */
  static fromResponse (statusCode, raw) {
    const parsed = tryParseJson(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new DidClientError(
        `Redeem answered HTTP ${statusCode} with a body that is not a ` +
        `JSON object: ${raw}`, statusCode, raw);
    }
    return new RedeemResult(statusCode, raw, parsed);
  }

  /**
   * The result in the cloud's own response shape (`signature`, `context`,
   * `factors` when present, `verifiedAt`, `secondsSinceVerified`), so a
   * server can answer a page with it directly. `signature` is left out when
   * the cloud did not report it, as the cloud leaves it out.
   * @returns {object} the plain object for JSON.stringify
   */
  toJSON () {
    const body = {};
    if (this.signature !== SignatureResult.UNKNOWN) {
      body.signature = this.signature;
    }
    body.context = this.context;
    if (this.factors !== undefined) {
      body.factors = this.factors;
    }
    if (this.verifiedAt !== undefined) {
      // ISO 8601 UTC to the second, as the cloud writes it.
      body.verifiedAt = this.verifiedAt.toISOString().replace(/\.\d+Z$/, 'Z');
    }
    if (this.secondsSinceVerified !== undefined) {
      body.secondsSinceVerified = this.secondsSinceVerified;
    }
    return body;
  }
}

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
 * @property {string} [resourceKey] the page's resource key. Public by
 * nature, it travels in the route of the key and verify requests and in
 * the form body of the redeem request. Required for the public cloud. A
 * private cloud serves those routes with no resource key, so a client for
 * one is built without it.
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
class DidClient {
  /**
   * @param {DidClientOptions} options the resource key, where the cloud
   * takes one, and optionally the licence key, endpoint, transport and
   * clock
   */
  constructor (options) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('options are required');
    }
    const resourceKey = options.resourceKey === undefined ||
      options.resourceKey === null
      ? null
      : options.resourceKey;
    if (resourceKey !== null &&
      (typeof resourceKey !== 'string' || resourceKey.length === 0)) {
      throw new TypeError('resourceKey must be a non-empty string');
    }
    const endpoint = options.endpoint || environmentEndpoint() ||
      DEFAULT_ENDPOINT;
    // Normalised to end in exactly one slash so every URL is the base plus
    // a relative path, as the cloud request engine treats the same value.
    this._endpoint = endpoint.replace(/\/*$/, '/');
    if (resourceKey === null && this._endpoint === DEFAULT_ENDPOINT) {
      throw new TypeError('resourceKey is required for the public cloud');
    }
    /**
     * @type {string | null} the resource key the requests carry, or null
     * for a private cloud, whose routes take none
     */
    this._resourceKey = resourceKey;
    this._licenceKey = typeof options.licenceKey === 'string' &&
      options.licenceKey.length > 0
      ? options.licenceKey
      : null;
    const fetchFunction = options.fetch || globalThis.fetch;
    if (typeof fetchFunction !== 'function') {
      throw new TypeError('No fetch function is available. Run on Node 18 ' +
        'or later or in a browser, or pass one as options.fetch.');
    }
    /**
     * The transport, called as a plain function and never as a method of
     * the client, because a browser's fetch refuses to run as a method of
     * anything but the window.
     * @type {FetchFunction}
     */
    this._fetch = (url, init) => fetchFunction(url, init);
    this._now = typeof options.now === 'function'
      ? options.now
      : () => Date.now();
    /** @type {PublicKeyEntry[] | null} */
    this._keys = null;
    /** @type {number | null} when the whole list was last fetched */
    this._fetchedAt = null;
    /** @type {number | null} when the last limited fetch started */
    this._refetchedAt = null;
    /** @type {Promise<PublicKeyEntry[]> | null} */
    this._pending = null;
  }

  /** @returns {string} the API base every request is built on */
  get endpoint () {
    return this._endpoint;
  }

  /**
   * @returns {string | null} the resource key the requests carry, or null
   * where the cloud takes none
   */
  get resourceKey () {
    return this._resourceKey;
  }

  /**
   * The published signing keys, oldest first. The whole list is fetched on
   * first use and again once it is a day old. The cloud publishes a key
   * only from shortly before its period starts, so the keys from the newest
   * start held onwards are also fetched when an identifier's date reaches
   * the end of the list held (see {@link DidClient#publicKeyFor}). Every
   * answer is merged in by start, so no older key is dropped.
   * @returns {Promise<PublicKeyEntry[]>} the keys, oldest start first
   */
  publicKeys () {
    if (this._keys !== null && !this._stale()) {
      return Promise.resolve(this._keys);
    }
    return this._refresh(null);
  }

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
  async publicKeyFor (fodId) {
    const id = asFodId(fodId);
    const date = PublicKeys.createdAt(id);
    const keys = await this._keysFor(date);
    return PublicKeys.inForceAt(keys, date);
  }

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
  async verifySignature (fodId) {
    return (await this.verifySignatureDetailed(fodId)).valid;
  }

  /**
   * As {@link DidClient#verifySignature}, with the reason alongside the
   * answer, so a caller can tell an identifier no key covers from one whose
   * signature failed.
   * @param {FodId | string} fodId the identifier, or its base64
   * @returns {Promise<SignatureCheck>} the answer and its reason
   */
  async verifySignatureDetailed (fodId) {
    const id = asFodId(fodId);
    if (id.version !== SUPPORTED_VERSION) {
      return { valid: false, reason: SignatureReason.VERSION };
    }
    if (!payloadLengthValid(id)) {
      return { valid: false, reason: SignatureReason.LENGTH };
    }
    const date = PublicKeys.createdAt(id);
    const fetch = this._fetchFor(date);
    if (fetch !== null) {
      return checkAgainst(id, await fetch);
    }
    const held = this._keys;
    const check = await checkAgainst(id, held);
    if (check.reason !== SignatureReason.SIGNATURE) {
      return check;
    }
    const retry = this._refetch(startInForce(held, date));
    if (retry !== null) {
      return checkAgainst(id, await retry);
    }
    // The limit held the fetch back. Where another caller's fetch has
    // changed the list since the first check, check once more against it.
    return this._keys === held ? check : checkAgainst(id, this._keys);
  }

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
  async verify (fodId) {
    const id = identifierText(fodId);
    const url = this._endpoint + this._route('id/verify') +
      '?51did=' + encodeURIComponent(id) +
      '&owid=' + encodeURIComponent(id);
    const response = await this._fetch(url, {
      method: 'GET',
      headers: requestHeaders()
    });
    const body = await response.text();
    const parsed = tryParseJson(body);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.valid === 'boolean') {
        return parsed.valid;
      }
      if (response.status === 400 && Array.isArray(parsed.errors)) {
        throw new DidArgumentError(
          parsed.errors.join(' '), response.status, body);
      }
    }
    throw new DidClientError(
      `Verify answered HTTP ${response.status}: ${body}`,
      response.status, body);
  }

  /**
   * Redeems a sealed creator context result against the identifier, on the
   * server, with the licence key. The resource key, the 51Did, the sealed
   * result, the challenge and the licence key all travel in the body of a
   * POST to id/redeem, so none of them reaches an access log. (The redeem
   * endpoint takes the resource key in the form on a POST, where the key
   * and verify endpoints take it in the route on a GET, and a private
   * cloud takes none anywhere.) One use against the resource key, the
   * second of the two a browser context check costs.
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
  async redeem (fodId, result, challenge) {
    const id = identifierText(fodId);
    const form = new URLSearchParams();
    if (this._resourceKey !== null) {
      form.set('resource', this._resourceKey);
    }
    form.set('51did', id);
    form.set('result', typeof result === 'string' ? result : '');
    form.set('challenge', typeof challenge === 'string' ? challenge : '');
    if (this._licenceKey !== null) {
      form.set('license', this._licenceKey);
    }
    const url = this._endpoint + 'id/redeem';
    const response = await this._fetch(url, {
      method: 'POST',
      headers: requestHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      }),
      body: form.toString()
    });
    const body = await response.text();
    if (response.status === 200 || response.status === 503) {
      return RedeemResult.fromResponse(response.status, body);
    }
    if (response.status === 400) {
      const parsed = tryParseJson(body);
      const message = parsed && Array.isArray(parsed.errors)
        ? parsed.errors.join(' ')
        : body;
      throw new DidArgumentError(message, response.status, body);
    }
    if (response.status === 404) {
      throw new DidNotSupportedError(
        'The host does not offer the creator context: ' + body,
        response.status, body);
    }
    throw new DidClientError(
      `Redeem answered HTTP ${response.status}: ${body}`,
      response.status, body);
  }

  /**
   * The key list to select from for the given date, after the fetch
   * {@link DidClient#_fetchFor} calls for, where it calls for one.
   * @param {Date} date the identifier's date
   * @returns {Promise<PublicKeyEntry[]>} the keys to select from
   * @private
   */
  async _keysFor (date) {
    const fetch = this._fetchFor(date);
    return fetch === null ? this._keys : fetch;
  }

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
  _fetchFor (date) {
    if (this._keys === null || this._stale()) {
      return this._refresh(null);
    }
    if (PublicKeys.covers(this._keys, date)) {
      return null;
    }
    const keys = this._keys;
    return this._refetch(
      keys.length === 0 ? null : keys[keys.length - 1].startsAt);
  }

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
  _refetch (since) {
    if (this._pending !== null) {
      return this._pending;
    }
    const now = this._now();
    const elapsed = this._refetchedAt === null
      ? null
      : now - this._refetchedAt;
    // A clock set back is no reason to stop fetching.
    if (elapsed !== null && elapsed >= 0 && elapsed < REFETCH_INTERVAL_MS) {
      return null;
    }
    this._refetchedAt = now;
    return this._refresh(since);
  }

  /**
   * @returns {boolean} whether the list is missing or the whole list was
   * last fetched over a day ago
   * @private
   */
  _stale () {
    return this._fetchedAt === null ||
      this._now() - this._fetchedAt > KEY_LIST_MAX_AGE_MS;
  }

  /**
   * Fetches keys and merges the answer into the list held, sharing one
   * request between concurrent callers. Only a fetch of the whole list
   * resets the list's age.
   * @param {Date | null} since the start to fetch from, or null for the
   * whole list
   * @returns {Promise<PublicKeyEntry[]>} the list held after the merge
   * @private
   */
  _refresh (since) {
    if (this._pending === null) {
      this._pending = this._fetchKeys(since)
        .then((answer) => {
          this._keys = this._keys === null
            ? answer
            : PublicKeys.merge(this._keys, answer);
          if (since === null) {
            this._fetchedAt = this._now();
          }
          return this._keys;
        })
        .finally(() => {
          this._pending = null;
        });
    }
    return this._pending;
  }

  /**
   * GET id/key/{resource}, or id/key where the cloud takes no resource
   * key, and read each entry through {@link PublicKeys.fromList}, so
   * `startsAt` is read where present and `created` otherwise, `endsAt` is
   * kept, and `weekStart` is ignored. A start given is sent as `datetime`,
   * so the cloud answers with the keys that start then or later only.
   * @param {Date | null} since the start to fetch from, or null for the
   * whole list
   * @returns {Promise<PublicKeyEntry[]>} the answer, oldest start first
   * @private
   */
  async _fetchKeys (since) {
    let url = this._endpoint + this._route('id/key');
    if (since !== null) {
      // ISO 8601 UTC to the second, as the cloud writes it.
      url += '?datetime=' + encodeURIComponent(
        since.toISOString().replace(/\.\d+Z$/, 'Z'));
    }
    const response = await this._fetch(url, {
      method: 'GET',
      headers: requestHeaders()
    });
    const body = await response.text();
    if (response.status !== 200) {
      throw new DidClientError(
        `Public keys answered HTTP ${response.status}: ${body}`,
        response.status, body);
    }
    const parsed = tryParseJson(body);
    if (!Array.isArray(parsed)) {
      throw new DidClientError(
        'Public keys answered with a body that is not a JSON array: ' +
        body, response.status, body);
    }
    try {
      return PublicKeys.fromList(parsed);
    } catch (error) {
      throw new DidClientError(error.message, response.status, body);
    }
  }

  /**
   * A GET route with the resource key as its last segment, where the
   * client has one. A private cloud's routes carry none.
   * @param {string} route the route without the resource key
   * @returns {string} the route to put after the endpoint
   * @private
   */
  _route (route) {
    return this._resourceKey === null
      ? route
      : route + '/' + encodeURIComponent(this._resourceKey);
  }
}

/**
 * The identifier as a FodId, parsing a base64 string where one was given. A
 * string the reader cannot parse is reported as a DidArgumentError, the same
 * type the length guard and the cloud's own refusal use, so a caller
 * matching on DidClientError catches every bad argument in one place.
 * @param {FodId | string} value an identifier or its base64
 * @returns {FodId} the identifier
 */
function asFodId (value) {
  if (value instanceof FodId) {
    return value;
  }
  if (typeof value === 'string') {
    ensureEncodedLength(value);
    return parseOrRefuse(value);
  }
  throw new TypeError('fodId must be a FodId or a base64 string');
}

/**
 * The text sent to the cloud for an identifier. A parsed identifier goes in
 * the URL-safe alphabet, which needs no further encoding. A string is read
 * here first, so a value that is not a 51Did is refused before any request
 * is made, and then goes as given so the cloud sees what the page sent.
 * @param {FodId | string} value an identifier or its base64
 * @returns {string} the text to send
 */
function identifierText (value) {
  if (value instanceof FodId) {
    return value.asBase64Url();
  }
  if (typeof value === 'string' && value.length > 0) {
    ensureEncodedLength(value);
    parseOrRefuse(value);
    return value;
  }
  throw new TypeError('fodId must be a FodId or a non-empty base64 string');
}

/**
 * Reads a string as a 51Did, or refuses it as a DidArgumentError naming the
 * reason. The reason is the reader's own status, so a caller sees why the
 * value was refused without any key being fetched or any request made.
 * @param {string} value the encoded identifier, already within the length
 * guard
 * @returns {FodId} the identifier
 */
function parseOrRefuse (value) {
  const read = FodId.tryParse(value);
  if (!read.ok) {
    throw new DidArgumentError(
      'The value could not be read as a 51Did (' + read.status + ').');
  }
  return read.value;
}

/**
 * Turns away an encoded value too long to be worth decoding, before any
 * work is done on it. Whitespace at either end is ignored, as the reader
 * ignores it.
 * @param {string} value the encoded identifier as the caller gave it
 */
function ensureEncodedLength (value) {
  if (value.trim().length > MAXIMUM_ENCODED_LENGTH) {
    throw new DidArgumentError(
      'The value is longer than this client will read as a 51Did.');
  }
}

/**
 * Whether the payload is at least the base length for its type, being five
 * header bytes plus a 32 byte match key, or 16 for a Random identifier.
 * Anything beyond the base is a creator context section, whose exact
 * lengths belong to the cloud, so any longer payload is accepted here. The
 * reader already refuses a Probabilistic, HashedEmail or Random payload
 * shorter than its base, so in practice only a Reserved identifier, which
 * the reader accepts at any length from the header up, reaches this check
 * with too few bytes.
 * @param {FodId} fodId the identifier
 * @returns {boolean} whether the length is acceptable
 */
function payloadLengthValid (fodId) {
  const matchKeyLength = fodId.type === IdType.RANDOM
    ? layout.GUID_LENGTH
    : layout.MATCH_KEY_LENGTH;
  return fodId.payload.length >= layout.HEADER_LENGTH + matchKeyLength;
}

/**
 * The start to fetch from after a signature fails with every key held,
 * being the start of the newest key held that starts on or before the
 * identifier's date, so the answer carries that key's entry with any
 * earlier end and any replacement that starts in its period. Where no key
 * held starts that early, the oldest start held.
 * @param {PublicKeyEntry[]} keys the list held, oldest first
 * @param {Date} date the identifier's date
 * @returns {Date | null} the start, or null for an empty list
 */
function startInForce (keys, date) {
  let since = keys.length === 0 ? null : keys[0].startsAt;
  for (const key of keys) {
    if (key.startsAt.getTime() <= date.getTime()) {
      since = key.startsAt;
    }
  }
  return since;
}

/**
 * Checks the signature against the entries that may have signed the
 * identifier, chosen from the list by {@link PublicKeys.candidatesFor}.
 * @param {FodId} fodId the identifier
 * @param {PublicKeyEntry[]} keys the list to choose from
 * @returns {Promise<SignatureCheck>} the answer and its reason
 */
async function checkAgainst (fodId, keys) {
  const candidates = PublicKeys.candidatesFor(keys, fodId);
  if (candidates.length === 0) {
    return { valid: false, reason: SignatureReason.NO_KEY };
  }
  for (const key of candidates) {
    if (await fodId.verify(key.publicKey)) {
      return { valid: true, reason: SignatureReason.VERIFIED };
    }
  }
  return { valid: false, reason: SignatureReason.SIGNATURE };
}

/**
 * The API base the FOD_CLOUD_API_URL environment variable names, where the
 * runtime has environment variables. A browser has none.
 * @returns {string | undefined} the API base, or undefined where there is
 * no variable to read
 */
function environmentEndpoint () {
  return typeof process !== 'undefined' && process.env
    ? process.env.FOD_CLOUD_API_URL
    : undefined;
}

/**
 * The headers a request carries. On Node the package names itself in
 * `User-Agent` so the cloud can tell which package called. A browser sends
 * its own `User-Agent`, and one set by a page can make the browser ask the
 * cloud's permission with a preflight request first, so the header is left
 * out there and every request a page makes is a simple one.
 * @param {object} [headers] the headers the request needs besides
 * @returns {object} the headers to send
 */
function requestHeaders (headers) {
  return Object.assign(
    isNode() ? { 'User-Agent': USER_AGENT } : {}, headers);
}

/**
 * Whether the runtime is Node, which has environment variables and lets
 * a request name its sender.
 * @returns {boolean} true on Node
 */
function isNode () {
  return typeof process !== 'undefined' && !!process.versions &&
    typeof process.versions.node === 'string';
}

/**
 * Parses JSON without throwing.
 * @param {string} text a response body
 * @returns {any} the parsed JSON, or null when the text is not JSON
 */
function tryParseJson (text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

module.exports = {
  DidClient,
  RedeemResult,
  ContextResult,
  SignatureResult,
  FactorResult,
  Factor,
  SignatureReason,
  DidClientError,
  DidArgumentError,
  DidNotSupportedError,
  DEFAULT_ENDPOINT
};
