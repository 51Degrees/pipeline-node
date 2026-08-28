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
const IdType = require('./idType');
const packageVersion = require('./package.json').version;

/**
 * The public cloud API base, used when neither the endpoint option nor the
 * FOD_CLOUD_API_URL environment variable is set.
 */
const DEFAULT_ENDPOINT = 'https://cloud.51degrees.com/api/v4/';

/** Sent with every request so the cloud can tell which package called. */
const USER_AGENT = 'fiftyone.pipeline.did/' + packageVersion;

/** The OWID date field counts minutes from this moment. */
const OWID_EPOCH_MS = Date.UTC(2020, 0, 1);
const MINUTE_MS = 60 * 1000;

/**
 * How far either side of a key boundary a neighbouring key is also tried,
 * matching the tolerance the cloud applies. A creation time is recorded to
 * the minute and stamped a moment after the key was chosen, so an identifier
 * dated a few minutes past a boundary may carry the previous key's
 * signature, and one dated a few minutes before it may carry the next.
 */
const BOUNDARY_TOLERANCE_MS = 15 * MINUTE_MS;

/** A cached key list older than this is fetched again before use. */
const KEY_LIST_MAX_AGE_MS = 24 * 60 * MINUTE_MS;

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
  MISMATCH: 'mismatch'
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
     * @type {object | undefined} factor name to {@link FactorResult} value
     * (or null where nothing was compared), present only when the cloud
     * sent `factors`, which is the mismatch outcome. The names are
     * transport, device, browserip, connectionip, asn and browser.
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
 * response with `status` and a `text()` method. Node 18 and later provide
 * it globally, and tests inject one.
 * @callback FetchFunction
 * @param {string} url the absolute URL to request
 * @param {object} init the request options
 * @returns {Promise<{status: number, text: function(): Promise<string>}>}
 * the response
 */

/**
 * A published signing key and the moment it came into force. A key stays in
 * force until the next key starts.
 * @typedef {object} PublicKeyEntry
 * @property {Date} startsAt when the key came, or comes, into force
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
 * segment. Defaults to the FOD_CLOUD_API_URL environment variable, then
 * to the public cloud. A value without a trailing slash gains one.
 * @property {FetchFunction} [fetch] the HTTP transport. Defaults to the
 * global `fetch`.
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
 * One instance can serve a whole server.
 */
class DidClient {
  /**
   * @param {DidClientOptions} options the resource key, and optionally the
   * licence key, endpoint, transport and clock
   */
  constructor (options) {
    if (!options || typeof options.resourceKey !== 'string' ||
      options.resourceKey.length === 0) {
      throw new TypeError('resourceKey is required');
    }
    this._resourceKey = options.resourceKey;
    this._licenceKey = typeof options.licenceKey === 'string' &&
      options.licenceKey.length > 0
      ? options.licenceKey
      : null;
    const endpoint = options.endpoint || process.env.FOD_CLOUD_API_URL ||
      DEFAULT_ENDPOINT;
    // Normalised to end in exactly one slash so every URL is the base plus
    // a relative path, as the cloud request engine treats the same value.
    this._endpoint = endpoint.replace(/\/*$/, '/');
    const fetchFunction = options.fetch || globalThis.fetch;
    if (typeof fetchFunction !== 'function') {
      throw new TypeError('No fetch function is available. Run on Node 18 ' +
        'or later, or pass one as options.fetch.');
    }
    /** @type {FetchFunction} */
    this._fetch = fetchFunction;
    this._now = typeof options.now === 'function'
      ? options.now
      : () => Date.now();
    /** @type {PublicKeyEntry[] | null} */
    this._keys = null;
    /** @type {number | null} */
    this._fetchedAt = null;
    /** @type {Promise<PublicKeyEntry[]> | null} */
    this._pending = null;
  }

  /** @returns {string} the API base every request is built on */
  get endpoint () {
    return this._endpoint;
  }

  /** @returns {string} the resource key the requests carry */
  get resourceKey () {
    return this._resourceKey;
  }

  /**
   * The published signing keys, oldest first, fetched on first use and
   * then served from the cache until the list is a day old. Keys are
   * published up to three months ahead of their start, so the list holds
   * entries that have not started yet.
   * @returns {Promise<PublicKeyEntry[]>} the keys, oldest start first
   */
  publicKeys () {
    if (this._keys !== null && !this._stale()) {
      return Promise.resolve(this._keys);
    }
    return this._refresh();
  }

  /**
   * The key in force when the identifier was created, being the entry whose
   * start is latest on or before the identifier's date. The list is fetched
   * again, once, before answering when no entry covers the date, when the
   * date is later than the newest start held, or when the list is more than
   * a day old.
   * @param {FodId | string} fodId the identifier, or its base64
   * @returns {Promise<PublicKeyEntry | null>} the key, or null when the
   * date precedes every published key
   */
  async publicKeyFor (fodId) {
    const id = asFodId(fodId);
    const date = dateOf(id);
    const keys = await this._keysFor(date);
    return inForceAt(keys, date);
  }

  /**
   * Verifies the identifier's signature offline against the published keys,
   * as the cloud's own verify endpoint does. The envelope version must be
   * the one the cloud signs, the payload must be at least the base length
   * for its type (a longer payload carries a creator context and is
   * accepted), and the signature must verify against the key in force at
   * the identifier's date or, within a short tolerance either side of a
   * period boundary, the neighbouring key. No earlier key is ever tried, so
   * a key leaked from one period cannot sign an identifier dated in
   * another.
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
    const date = dateOf(id);
    const keys = await this._keysFor(date);
    const candidates = candidatesForDate(keys, date);
    if (candidates.length === 0) {
      return { valid: false, reason: SignatureReason.NO_KEY };
    }
    for (const key of candidates) {
      if (await id.verify(key.publicKey)) {
        return { valid: true, reason: SignatureReason.VERIFIED };
      }
    }
    return { valid: false, reason: SignatureReason.SIGNATURE };
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
   * @throws {DidArgumentError} when the cloud could not parse the value as
   * a 51Did, with the cloud's message
   * @throws {DidClientError} on any other answer than valid or invalid
   */
  async verify (fodId) {
    const id = identifierText(fodId);
    const url = this._endpoint + 'id/verify/' +
      encodeURIComponent(this._resourceKey) +
      '?51did=' + encodeURIComponent(id) +
      '&owid=' + encodeURIComponent(id);
    const response = await this._fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT }
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
   * @throws {DidArgumentError} when the cloud could not parse the value as
   * a 51Did (HTTP 400), with the cloud's message
   * @throws {DidNotSupportedError} when the host does not offer the creator
   * context (HTTP 404)
   * @throws {DidClientError} on any other status
   */
  async redeem (fodId, result, challenge) {
    const id = identifierText(fodId);
    const form = new URLSearchParams();
    form.set('resource', this._resourceKey);
    form.set('51did', id);
    form.set('result', typeof result === 'string' ? result : '');
    form.set('challenge', typeof challenge === 'string' ? challenge : '');
    if (this._licenceKey !== null) {
      form.set('license', this._licenceKey);
    }
    const url = this._endpoint + 'id/redeem';
    const response = await this._fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
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
   * The key list to select from for the given date, fetched again once
   * where the rule in {@link DidClient#publicKeyFor} calls for it and the
   * list was not just fetched.
   * @param {Date} date the identifier's date
   * @returns {Promise<PublicKeyEntry[]>} the keys to select from
   * @private
   */
  async _keysFor (date) {
    const fetchedBefore = this._fetchedAt;
    let keys = await this.publicKeys();
    if (this._fetchedAt === fetchedBefore && this._needsRefetch(keys, date)) {
      keys = await this._refresh();
    }
    return keys;
  }

  /**
   * Whether the held list should be fetched again before selecting for the
   * date.
   * @param {PublicKeyEntry[]} keys the held list, oldest first
   * @param {Date} date the identifier's date
   * @returns {boolean} true to fetch again
   * @private
   */
  _needsRefetch (keys, date) {
    if (inForceAt(keys, date) === null) {
      return true;
    }
    const newestStart = keys[keys.length - 1].startsAt;
    if (date.getTime() > newestStart.getTime()) {
      return true;
    }
    return this._stale();
  }

  /**
   * @returns {boolean} whether the held list is missing or over a day old
   * @private
   */
  _stale () {
    return this._fetchedAt === null ||
      this._now() - this._fetchedAt > KEY_LIST_MAX_AGE_MS;
  }

  /**
   * Fetches the key list, sharing one request between concurrent callers.
   * @returns {Promise<PublicKeyEntry[]>} the fresh list
   * @private
   */
  _refresh () {
    if (this._pending === null) {
      this._pending = this._fetchKeys()
        .then((keys) => {
          this._keys = keys;
          this._fetchedAt = this._now();
          return keys;
        })
        .finally(() => {
          this._pending = null;
        });
    }
    return this._pending;
  }

  /**
   * GET id/key/{resource} and read each entry's start and public key.
   * `startsAt` is read where present and `created` otherwise. Both are
   * supported start fields in key-list responses. `weekStart` is ignored.
   * @returns {Promise<PublicKeyEntry[]>} the keys, oldest start first
   * @private
   */
  async _fetchKeys () {
    const url = this._endpoint + 'id/key/' +
      encodeURIComponent(this._resourceKey);
    const response = await this._fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT }
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
    const keys = parsed.map((entry) => {
      const start = entry && (entry.startsAt || entry.created);
      const startsAt = typeof start === 'string' ? new Date(start) : null;
      if (startsAt === null || isNaN(startsAt.getTime()) ||
        typeof entry.publicKey !== 'string') {
        throw new DidClientError(
          'Public keys entry lacks a start or a publicKey: ' +
          JSON.stringify(entry), response.status, body);
      }
      return Object.freeze({ startsAt, publicKey: entry.publicKey });
    });
    keys.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return Object.freeze(keys);
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
    try {
      return FodId.fromBase64(value);
    } catch (error) {
      throw new DidArgumentError(
        'The value could not be read as a 51Did. ' + error.message);
    }
  }
  throw new TypeError('fodId must be a FodId or a base64 string');
}

/**
 * The text sent to the cloud for an identifier. A parsed identifier goes in
 * the URL-safe alphabet, which needs no further encoding, and a string goes
 * as given so the cloud can report its own parse error.
 * @param {FodId | string} value an identifier or its base64
 * @returns {string} the text to send
 */
function identifierText (value) {
  if (value instanceof FodId) {
    return value.asBase64Url();
  }
  if (typeof value === 'string' && value.length > 0) {
    ensureEncodedLength(value);
    return value;
  }
  throw new TypeError('fodId must be a FodId or a non-empty base64 string');
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
 * The identifier's creation moment as a Date.
 * @param {FodId} fodId the identifier
 * @returns {Date} the moment the envelope says it was created
 */
function dateOf (fodId) {
  return new Date(OWID_EPOCH_MS + fodId.dateMinutes * MINUTE_MS);
}

/**
 * Whether the payload is at least the base length for its type, being five
 * header bytes plus a 32 byte match key, or 16 for a Random identifier.
 * Anything beyond the base is a creator context section, whose exact
 * lengths belong to the cloud, so any longer payload is accepted here.
 * @param {FodId} fodId the identifier
 * @returns {boolean} whether the length is acceptable
 */
function payloadLengthValid (fodId) {
  const valueLength = fodId.type === IdType.RANDOM
    ? FodId.GUID_LENGTH
    : FodId.HASH_LENGTH;
  return fodId.payload.length >= FodId.HEADER_LENGTH + valueLength;
}

/**
 * The entry in force at the moment, being the newest whose start has
 * passed, or null when the moment precedes every entry.
 * @param {PublicKeyEntry[]} keys the schedule, in any order
 * @param {Date} at the moment
 * @returns {PublicKeyEntry | null} the entry in force
 */
function inForceAt (keys, at) {
  let best = null;
  for (const key of keys) {
    if (key.startsAt.getTime() > at.getTime()) {
      continue;
    }
    if (best === null || key.startsAt.getTime() > best.startsAt.getTime()) {
      best = key;
    }
  }
  return best;
}

/**
 * The entries that may have signed something created at the moment, best
 * first: the entry in force, then the entry in force a tolerance earlier
 * and the entry in force a tolerance later where those differ. Deliberately
 * not every earlier entry.
 * @param {PublicKeyEntry[]} keys the schedule, in any order
 * @param {Date} at the moment
 * @returns {PublicKeyEntry[]} the entries to try, best first
 */
function candidatesForDate (keys, at) {
  const candidates = [];
  const add = (entry) => {
    if (entry !== null && candidates.indexOf(entry) < 0) {
      candidates.push(entry);
    }
  };
  add(inForceAt(keys, at));
  add(inForceAt(keys, new Date(at.getTime() - BOUNDARY_TOLERANCE_MS)));
  add(inForceAt(keys, new Date(at.getTime() + BOUNDARY_TOLERANCE_MS)));
  return candidates;
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
  SignatureReason,
  DidClientError,
  DidArgumentError,
  DidNotSupportedError,
  DEFAULT_ENDPOINT
};
