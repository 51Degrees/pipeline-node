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

const owid = require('owid');
const IdType = require('./idType');
const FodIdParseError = require('./fodIdParseError');

/**
 * Why a read of a 51Did succeeded or failed. The OWID library's own
 * vocabulary is carried through unchanged, because a 51Did failing to be
 * an OWID is reported exactly as the OWID library reported it, and two
 * members are added for the outcomes that belong to the 51Did payload
 * rather than to the envelope. Frozen, and compared by value rather than
 * by the text of any message.
 */
const ParseStatus = Object.freeze(Object.assign({}, owid.ParseStatus, {
  /**
   * The payload is shorter than the five byte header (one byte of flags
   * and four bytes of licence id), so not even the identifier type can be
   * read.
   */
  PAYLOAD_TOO_SHORT: 'PayloadTooShort',
  /**
   * The header was read and named a type, and the payload is shorter than
   * the match key that type carries after the header (16 GUID bytes for
   * Random, 32 hash bytes for Probabilistic and HashedEmail).
   */
  INVALID_TYPE_PAYLOAD_LENGTH: 'InvalidTypePayloadLength'
}));

/**
 * The answer from {@link FodId.tryParse} and {@link FodId.tryFromByteArray}.
 * Frozen. On success `ok` is true, `value` is the identifier and `status`
 * is `ParseStatus.PARSED`. On failure `ok` is false, `value` is null, never
 * a half read identifier, and `status` names the reason.
 * @typedef {object} FodIdParseResult
 * @property {boolean} ok whether the input was a structurally valid 51Did
 * @property {FodId | null} value the identifier on success, null on failure
 * @property {string} status one of {@link FodId.ParseStatus}
 */

/**
 * A strongly typed reader for the 51Did (51Degrees Identifier) value returned
 * by the 51Degrees Cloud service.
 *
 * A 51Did is described at three levels. The 51Did is the identifier as a
 * whole. The envelope is the signed OWID that carries it (version, domain,
 * date, payload, signature), re-issued fresh on every call. The match key
 * is the stable, comparable part of the payload after the Flags and License
 * Id, exposed via {@link FodId#matchKey}. Two 51Dids for the same inputs
 * share the same match key even though their envelopes differ. Compare
 * match keys, never envelopes.
 *
 * Reading and verifying are two separate questions. {@link FodId.tryParse}
 * and {@link FodId.tryFromByteArray} answer whether the input is a
 * structurally valid 51Did, with a status rather than an exception, and a
 * successful read says nothing about the signature. {@link FodId.fromBase64}
 * and {@link FodId.fromByteArray} are the same read for callers who prefer
 * an exception. No read fetches a key or checks a signature, so a parsed
 * 51Did is not necessarily genuine. Call {@link FodId#verify} or
 * {@link FodId#checkSignature} for that.
 *
 * A FodId composes the OWID the OWID library read (holds it and delegates
 * the envelope fields to it). That OWID is frozen and hands out its byte
 * arrays as copies, so nothing a caller holds can change the identifier.
 */
class FodId {
  static FLAGS_OFFSET = 0;
  static LICENSE_ID_OFFSET = 1;
  static LICENSE_ID_LENGTH = 4;
  /** Byte offset of the match key field within the payload. */
  static MATCH_KEY_OFFSET = 5;
  /**
   * Byte length of the match key field for Probabilistic and HashedEmail
   * identifiers, being a SHA-256.
   */
  static MATCH_KEY_LENGTH = 32;
  /**
   * Deprecated alias for {@link FodId.MATCH_KEY_OFFSET}. The stable,
   * comparable part of a 51Did is now called the match key, mirroring the
   * Model Terms for Marketing vocabulary. This alias will be removed in a
   * future release.
   * @deprecated Renamed to MATCH_KEY_OFFSET. This alias will be removed in
   * a future release.
   */
  static HASH_OFFSET = FodId.MATCH_KEY_OFFSET;
  /**
   * Deprecated alias for {@link FodId.MATCH_KEY_LENGTH}. The stable,
   * comparable part of a 51Did is now called the match key, mirroring the
   * Model Terms for Marketing vocabulary. This alias will be removed in a
   * future release.
   * @deprecated Renamed to MATCH_KEY_LENGTH. This alias will be removed in
   * a future release.
   */
  static HASH_LENGTH = FodId.MATCH_KEY_LENGTH;
  static HEADER_LENGTH = FodId.MATCH_KEY_OFFSET;
  /** Byte length of the GUID match key carried by Random identifiers. */
  static GUID_LENGTH = 16;
  static RANDOM_PAYLOAD_LENGTH = 21;
  static PAYLOAD_LENGTH = FodId.MATCH_KEY_OFFSET + FodId.MATCH_KEY_LENGTH;

  /**
   * Why a read succeeded or failed, being the OWID library's statuses plus
   * `PAYLOAD_TOO_SHORT` and `INVALID_TYPE_PAYLOAD_LENGTH`. Frozen.
   * @type {Readonly<Record<string, string>>}
   */
  static ParseStatus = ParseStatus;

  /**
   * The outcome of asking whether a signature is genuine, as reported by
   * {@link FodId#checkSignature}. The OWID library's own frozen object.
   * Only `SIGNATURE_VALID` and `SIGNATURE_INVALID` judge the signature, and
   * every other member says the question could not be answered.
   * @type {Readonly<Record<string, string>>}
   */
  static SignatureStatus = owid.SignatureStatus;

  /**
   * Builds a 51Did from an OWID the OWID library read. The OWID is not
   * aliased. Its base64 is read again through the same walk every other
   * surface uses, so a FodId built this way is identical to one from
   * {@link FodId.fromBase64} and can never disagree with its envelope.
   * @param {object} owidInstance an OWID from `owid.parse` or
   * `owid.parseBytes`, or any object carrying the envelope base64 as `data`
   * @throws {TypeError} when no OWID was given
   * @throws {RangeError} when the payload is shorter than a 51Did of its
   * type can be
   * @throws {FodIdParseError} when the base64 is not an OWID
   */
  constructor (owidInstance) {
    if (owidInstance === null || owidInstance === undefined) {
      throw new TypeError('owid must not be null or undefined');
    }
    if (typeof owidInstance.data !== 'string') {
      throw new TypeError(
        'owid must be an OWID read by the OWID library, carrying its ' +
        'base64 as data');
    }
    const read = readBase64(owidInstance.data);
    if (!read.ok) {
      throw errorFor(read);
    }
    /** @type {object} the OWID the OWID library read, frozen */
    this._owid = read.value._owid;
    /** @type {number} the flags byte */
    this._flags = read.value._flags;
    /** @type {number} the licence id field, unsigned */
    this._licenseId = read.value._licenseId;
    /** @type {Uint8Array} this identifier's own copy of the match key bytes */
    this._matchKey = read.value._matchKey;
  }

  /**
   * Restores a base64 string in either alphabet to the standard alphabet
   * with padding, which is the only form the OWID library decodes. Leading
   * and trailing whitespace is stripped first, so a value carried through a
   * log line, a text field or a copy and paste with a stray newline still
   * parses. The URL-safe characters `-` and `_` become `+` and `/`, then
   * padding is added where the stripped length calls for it. A string
   * already in the standard form comes back unchanged.
   * @param {string} value base64 in the standard or URL-safe alphabet, with
   * or without padding, and with or without surrounding whitespace
   * @returns {string} the same bytes in the standard alphabet with padding
   */
  static toStandardBase64 (value) {
    if (typeof value !== 'string') {
      throw new TypeError('value must be a string');
    }
    let base64 = value.trim().replace(/-/g, '+').replace(/_/g, '/');
    switch (base64.length % 4) {
      case 2: base64 += '=='; break;
      case 3: base64 += '='; break;
    }
    return base64;
  }

  /**
   * Converts a base64 string in either alphabet to the URL-safe alphabet
   * without padding, the inverse of {@link FodId.toStandardBase64}, so the
   * value can be placed in a URL without further encoding.
   * @param {string} value base64 in the standard or URL-safe alphabet
   * @returns {string} the same bytes in the URL-safe alphabet, no padding
   */
  static toBase64Url (value) {
    if (typeof value !== 'string') {
      throw new TypeError('value must be a string');
    }
    return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Reads a 51Did from its base64 form without throwing. Both base64
   * alphabets are accepted, the standard one the cloud issues and the
   * URL-safe one a page uses in a link, with or without padding. The value
   * may be anything at all, because a 51Did arrives from outside and
   * failing to be one is an ordinary outcome. An absent value or an empty
   * string is `MISSING_INPUT`, a value that is not a string is
   * `INVALID_INPUT_TYPE`, and a reason from the OWID library is reported
   * exactly as the OWID library reported it.
   *
   * A successful read says the bytes are a structurally valid 51Did. It
   * fetches no key and checks no signature, so the identifier may still be
   * a forgery. Call {@link FodId#verify} or {@link FodId#checkSignature}.
   * @param {string} base64 the envelope in either base64 alphabet
   * @returns {FodIdParseResult} a frozen result with `ok`, `value` and
   * `status`
   */
  static tryParse (base64) {
    return publicResult(readBase64(base64));
  }

  /**
   * Reads a 51Did from the raw bytes of an OWID envelope without throwing.
   * The buffer must hold exactly one envelope, as `owid.parseBytes`
   * requires. An absent buffer or one of no bytes is `MISSING_INPUT`, a
   * value that is not a byte array is `INVALID_INPUT_TYPE`, and a reason
   * from the OWID library is reported exactly as the OWID library reported
   * it. The bytes are copied, so changing the buffer afterwards does not
   * change the identifier.
   * @param {Uint8Array} buffer the envelope bytes
   * @returns {FodIdParseResult} a frozen result with `ok`, `value` and
   * `status`
   */
  static tryFromByteArray (buffer) {
    return publicResult(readEnvelope(owid.parseBytes(buffer)));
  }

  /**
   * Parses a 51Did from its base64-encoded OWID string, throwing when the
   * value is not one. The same read as {@link FodId.tryParse}, for a caller
   * who prefers an exception. Both base64 alphabets are accepted, and the
   * envelope is held in the standard form, so {@link FodId#asBase64}
   * returns the standard alphabet with padding whichever form was given.
   * @param {string} base64 the envelope in either base64 alphabet
   * @returns {FodId} the parsed identifier, whose signature has not been
   * checked
   * @throws {TypeError} when the value is not a string
   * @throws {RangeError} when the payload is shorter than a 51Did of its
   * type can be
   * @throws {FodIdParseError} when the value is not an OWID, with the OWID
   * library's status
   */
  static fromBase64 (base64) {
    if (typeof base64 !== 'string') {
      throw new TypeError('base64 must be a string');
    }
    return valueOrThrow(readBase64(base64));
  }

  /**
   * Parses a 51Did from the raw bytes of an OWID envelope, throwing when
   * the bytes are not one. The same read as {@link FodId.tryFromByteArray}.
   * @param {Uint8Array} buffer the envelope bytes
   * @returns {FodId} the parsed identifier, whose signature has not been
   * checked
   * @throws {TypeError} when the value is not a Uint8Array
   * @throws {RangeError} when the payload is shorter than a 51Did of its
   * type can be
   * @throws {FodIdParseError} when the bytes are not an OWID, with the OWID
   * library's status
   */
  static fromByteArray (buffer) {
    if (!(buffer instanceof Uint8Array)) {
      throw new TypeError('buffer must be a Uint8Array');
    }
    return valueOrThrow(readEnvelope(owid.parseBytes(buffer)));
  }

  /**
   * Promotes an OWID the OWID library read into a 51Did. The OWID is not
   * aliased. Its base64 is read again through the same walk as
   * {@link FodId.fromBase64}, so the FodId can never disagree with its
   * envelope.
   * @param {object} owidInstance an OWID from `owid.parse` or
   * `owid.parseBytes`
   * @returns {FodId} the parsed identifier, whose signature has not been
   * checked
   * @throws {TypeError} when no OWID was given
   */
  static fromOwid (owidInstance) {
    if (owidInstance === null || owidInstance === undefined) {
      throw new TypeError('owid must not be null or undefined');
    }
    return new FodId(owidInstance);
  }

  /** @returns {number} the 1-byte usage flags bit-mask (0-255). */
  get flags () {
    return this._flags;
  }

  /** @returns {number} the IdType carried in bits 6-7 of the flags. */
  get type () {
    return IdType.fromFlags(this._flags);
  }

  /**
   * The 4-byte little-endian field at offset 1 of the payload, as an
   * unsigned integer (0-4294967295).
   *
   * On an identifier carrying a creator context these four bytes hold an
   * encrypted value that only 51Degrees can turn back into a licence
   * identifier, so the number returned here is the field's raw value and
   * identifies nothing outside 51Degrees. It is still stable for a given
   * identifier, so it remains usable as an opaque part of the payload, but
   * it must not be read as a licence number.
   * @returns {number} the raw field value
   */
  get licenseId () {
    return this._licenseId;
  }

  /**
   * The match key, being the stable, comparable part of the payload after
   * the Flags and License Id. A 32-byte SHA-256 for Probabilistic and
   * HashedEmail identifiers, or 16 GUID bytes for Random. Two 51Dids for
   * the same inputs share the same match key, so the match key is the
   * cache and deduplication key.
   * @returns {Uint8Array} a defensive copy of the match key bytes
   */
  get matchKey () {
    return this._matchKey.slice();
  }

  /**
   * Deprecated alias for {@link FodId#matchKey}. The stable, comparable
   * part of a 51Did is now called the match key, mirroring the Model Terms
   * for Marketing vocabulary. This alias will be removed in a future
   * release.
   * @deprecated Renamed to matchKey. This alias will be removed in a future
   * release.
   * @returns {Uint8Array} the same bytes as {@link FodId#matchKey}
   */
  get hash () {
    return this.matchKey;
  }

  /** @returns {number} the OWID version. */
  get version () {
    return this._owid.version;
  }

  /** @returns {string} the domain of the OWID creator. */
  get domain () {
    return this._owid.domain;
  }

  /**
   * @returns {number} the OWID date as minutes since 2020-01-01 UTC, as an
   * unsigned 32-bit number, the same value as {@link FodId#dateMinutes}.
   */
  get date () {
    return this._owid.date;
  }

  /**
   * The envelope's own date as the unsigned 32-bit count of minutes since
   * 2020-01-01T00:00:00Z, exactly as the wire carries it. This is the value
   * the OWID `public-key?date=` parameter takes, and the integer to use when
   * comparing creation times. The OWID library now reads the field unsigned
   * too, so {@link FodId#date} agrees with this getter. The getter is kept
   * because callers were told to use it, and it still forces the unsigned
   * reading should the field ever arrive signed.
   * @returns {number} minutes since 2020-01-01T00:00:00Z
   */
  get dateMinutes () {
    return this._owid.date >>> 0;
  }

  /** @returns {Uint8Array} a fresh copy of the OWID payload bytes. */
  get payload () {
    return this._owid.payload;
  }

  /** @returns {Uint8Array} a fresh copy of the 64-byte OWID signature. */
  get signature () {
    return this._owid.signature;
  }

  /**
   * @returns {string} the OWID as a base64 string in the standard alphabet
   * with padding, the form the cloud issues.
   */
  asBase64 () {
    return this._owid.data;
  }

  /**
   * The envelope in the URL-safe base64 alphabet without padding, the form
   * to place in a URL or a link. {@link FodId.fromBase64} accepts it back.
   * @returns {string} the OWID as URL-safe base64, no padding
   */
  asBase64Url () {
    return FodId.toBase64Url(this._owid.data);
  }

  /** @returns {Uint8Array} the OWID envelope as raw bytes. */
  asByteArray () {
    return Uint8Array.from(atob(this._owid.data), (c) => c.charCodeAt(0));
  }

  /**
   * Verifies the OWID signature against the supplied SPKI public key PEM,
   * offline. This is an explicit, separate step, because no read verifies.
   * Resolves true or false only when the signature was judged, and rejects
   * when the question could not be answered (a key that cannot be imported,
   * or no Web Crypto), because a caller told false would treat an outage as
   * a forgery. {@link FodId#checkSignature} reports the same outcomes as
   * named statuses. Asynchronous because it uses Web Crypto.
   * @param {string} publicPem the creator public key in SPKI PEM form
   * @returns {Promise<boolean>} true when the signature is genuine for the
   * key, false when it is not
   */
  verify (publicPem) {
    return this._owid.verifyWithPublicKey(publicPem, []);
  }

  /**
   * Verifies the OWID signature against the supplied SPKI public key PEM,
   * offline, and reports the outcome as one of {@link FodId.SignatureStatus}
   * so that "could not check" stays apart from "does not match". Only
   * `SIGNATURE_INVALID` means the identifier should be distrusted.
   * @param {string} publicPem the creator public key in SPKI PEM form
   * @returns {Promise<{ok: boolean, status: string, message?: string,
   * cause?: any}>} a frozen result carrying `ok`, `status` and, where the
   * check could not be completed, a `message` and a `cause`
   */
  checkSignature (publicPem) {
    return this._owid.checkSignatureWithPublicKey(publicPem, []);
  }
}

/**
 * Reads the 51Did fields out of an envelope payload, answering with a
 * status rather than throwing. This is the one walk of the payload, shared
 * by every surface that reads a 51Did. The type is read from the header and
 * decides the least the payload must hold after the header. Anything beyond
 * the match key is a creator context section whose lengths belong to the
 * cloud, so a longer payload is accepted whatever its length.
 * @param {Uint8Array} payload the payload bytes
 * @returns {{status: string, flags?: number, licenseId?: number,
 * matchKey?: Uint8Array, length: number, required: number, type?: number}}
 * `status` PARSED with the fields, or a 51Did status with the length the
 * type needed
 */
function unpack (payload) {
  const length = payload.length;
  if (length < FodId.HEADER_LENGTH) {
    return {
      status: ParseStatus.PAYLOAD_TOO_SHORT,
      length,
      required: FodId.HEADER_LENGTH
    };
  }
  const flags = payload[FodId.FLAGS_OFFSET];
  // Little-endian unsigned 32-bit. `>>> 0` forces unsigned so the high bit
  // does not produce a negative number.
  const licenseId = (
    payload[FodId.LICENSE_ID_OFFSET] |
    (payload[FodId.LICENSE_ID_OFFSET + 1] << 8) |
    (payload[FodId.LICENSE_ID_OFFSET + 2] << 16) |
    (payload[FodId.LICENSE_ID_OFFSET + 3] << 24)
  ) >>> 0;
  const type = IdType.fromFlags(flags);
  let matchKeyLength;
  if (type === IdType.RANDOM) {
    matchKeyLength = FodId.GUID_LENGTH;
  } else if (type === IdType.RESERVED) {
    // Not yet assigned, so read best-effort, whatever follows the header
    // is the match key.
    matchKeyLength = length - FodId.HEADER_LENGTH;
  } else {
    matchKeyLength = FodId.MATCH_KEY_LENGTH;
  }
  const required = FodId.HEADER_LENGTH + matchKeyLength;
  if (length < required) {
    return {
      status: ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH,
      length,
      required,
      type
    };
  }
  return {
    status: ParseStatus.PARSED,
    flags,
    licenseId,
    // slice() copies, so the stored match key is this identifier's own.
    matchKey: payload.slice(
      FodId.MATCH_KEY_OFFSET, FodId.MATCH_KEY_OFFSET + matchKeyLength),
    length,
    required
  };
}

/**
 * Turns the OWID library's read into a 51Did read. An OWID failure is
 * carried through with its status unchanged, and a success is then held to
 * the 51Did payload rules. The identifier is built without the public
 * constructor so that the payload is walked once.
 * @param {object} read the result of `owid.parse` or `owid.parseBytes`
 * @returns {{ok: boolean, value: FodId | null, status: string,
 * detail?: object}} the read, with the payload lengths alongside a 51Did
 * failure for the throwing surfaces' messages
 */
function readEnvelope (read) {
  if (!read.ok) {
    return { ok: false, value: null, status: read.status };
  }
  const unpacked = unpack(read.owid.payload);
  if (unpacked.status !== ParseStatus.PARSED) {
    return {
      ok: false, value: null, status: unpacked.status, detail: unpacked
    };
  }
  const fodId = Object.create(FodId.prototype);
  fodId._owid = read.owid;
  fodId._flags = unpacked.flags;
  fodId._licenseId = unpacked.licenseId;
  fodId._matchKey = unpacked.matchKey;
  return { ok: true, value: fodId, status: ParseStatus.PARSED };
}

/**
 * Reads a 51Did from base64 in either alphabet. Only a string is
 * normalised, so anything else reaches the OWID library as it is and is
 * reported by the OWID library's own rules for absent and wrongly typed
 * input.
 * @param {*} base64 whatever the caller gave
 * @returns {{ok: boolean, value: FodId | null, status: string,
 * detail?: object}} the read
 */
function readBase64 (base64) {
  const normalised = typeof base64 === 'string'
    ? FodId.toStandardBase64(base64)
    : base64;
  return readEnvelope(owid.parse(normalised));
}

/**
 * The three facts a caller of a non-throwing surface is given, and nothing
 * else, frozen.
 * @param {{ok: boolean, value: FodId | null, status: string}} read the read
 * @returns {FodIdParseResult} the result
 */
function publicResult (read) {
  return Object.freeze({ ok: read.ok, value: read.value, status: read.status });
}

/**
 * The identifier from a read, or the exception the throwing surfaces
 * document for the failure.
 * @param {{ok: boolean, value: FodId | null, status: string,
 * detail?: object}} read the read
 * @returns {FodId} the identifier
 */
function valueOrThrow (read) {
  if (!read.ok) {
    throw errorFor(read);
  }
  return read.value;
}

/**
 * The exception for a failed read. The two 51Did payload statuses keep the
 * RangeError this package has always thrown for them, and every OWID status
 * is a FodIdParseError carrying the status. Each error carries `status` so
 * the reason can be acted on without reading the message.
 * @param {{status: string, detail?: object}} read the failed read
 * @returns {Error} the error to throw
 */
function errorFor (read) {
  let error;
  if (read.status === ParseStatus.PAYLOAD_TOO_SHORT) {
    error = new RangeError(
      `51Did payload must be at least ${read.detail.required} bytes to ` +
      `carry the flags and licence id, and ${read.detail.length} were given.`);
  } else if (read.status === ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH) {
    error = new RangeError(
      `51Did payload for the ${IdType.name(read.detail.type)} type must be ` +
      `at least ${read.detail.required} bytes, and ${read.detail.length} ` +
      'were given.');
  } else {
    return new FodIdParseError(read.status);
  }
  error.status = read.status;
  return error;
}

module.exports = FodId;
