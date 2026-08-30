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

/**
 * A strongly typed reader for the 51Did (51Degrees Identifier) value returned
 * by the 51Degrees Cloud service.
 *
 * A 51Did is described at three levels. The 51Did is the identifier as a
 * whole. The envelope is the signed OWID that carries it (version, domain,
 * date, payload, signature), re-issued fresh on every call. The value is the
 * stable, comparable part of the payload after the Flags and License Id,
 * exposed via {@link FodId#hash}. Two 51Dids for the same inputs share the
 * same value even though their envelopes differ. Compare values, never
 * envelopes.
 *
 * The owid-js library is verify-only and exposes no instance asBase64, so this
 * type composes an owid instance (holds it and delegates) and keeps the
 * original base64 for {@link FodId#asBase64}. Construction does NOT verify the
 * signature; call {@link FodId#verify} (async) explicitly.
 */
class FodId {
  static FLAGS_OFFSET = 0;
  static LICENSE_ID_OFFSET = 1;
  static LICENSE_ID_LENGTH = 4;
  static HASH_OFFSET = 5;
  static HASH_LENGTH = 32;
  static HEADER_LENGTH = 5;
  static GUID_LENGTH = 16;
  static RANDOM_PAYLOAD_LENGTH = 21;
  static PAYLOAD_LENGTH = 37;

  /**
   * Promotes an already-parsed owid instance into a 51Did by unpacking its
   * payload. The owid is **copied** (re-parsed from its base64), not aliased,
   * so a FodId can never desync from its envelope if the caller later mutates
   * the owid they passed in.
   * @param {object} owidInstance an owid instance (from `new owid(base64)`)
   */
  constructor (owidInstance) {
    if (owidInstance === null || owidInstance === undefined) {
      throw new TypeError('owid must not be null or undefined');
    }
    this._owid = new owid(owidInstance.data);
    const payload = this._owid.owid.payload;
    const length = payload ? payload.length : 0;
    if (!payload || length < FodId.HEADER_LENGTH) {
      throw new RangeError(
        `51Did payload must be at least ${FodId.HEADER_LENGTH} bytes; ` +
        `got ${length}.`);
    }
    this._flags = payload[FodId.FLAGS_OFFSET];
    // Little-endian unsigned 32-bit. `>>> 0` forces unsigned so the high bit
    // does not produce a negative number.
    this._licenseId = (
      payload[FodId.LICENSE_ID_OFFSET] |
      (payload[FodId.LICENSE_ID_OFFSET + 1] << 8) |
      (payload[FodId.LICENSE_ID_OFFSET + 2] << 16) |
      (payload[FodId.LICENSE_ID_OFFSET + 3] << 24)
    ) >>> 0;
    const type = IdType.fromFlags(this._flags);
    let valueLength;
    if (type === IdType.RANDOM) {
      valueLength = FodId.GUID_LENGTH;
    } else if (type === IdType.RESERVED) {
      valueLength = length - FodId.HEADER_LENGTH;
    } else {
      valueLength = FodId.HASH_LENGTH;
    }
    if (length < FodId.HEADER_LENGTH + valueLength) {
      throw new RangeError(
        `51Did payload for the ${IdType.name(type)} type must be at least ` +
        `${FodId.HEADER_LENGTH + valueLength} bytes; got ${length}.`);
    }
    // slice() copies, so the stored value cannot mutate the OWID payload.
    this._hash = payload.slice(
      FodId.HASH_OFFSET, FodId.HASH_OFFSET + valueLength);
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
   * Parses a 51Did from its base64-encoded OWID string. Both base64
   * alphabets are accepted, the standard one the cloud issues and the
   * URL-safe one a page uses in a link, with or without padding. The
   * envelope is held in the standard form, so {@link FodId#asBase64}
   * returns the standard alphabet with padding whichever form was given.
   * @param {string} base64 the envelope in either base64 alphabet
   * @returns {FodId} the parsed identifier
   */
  static fromBase64 (base64) {
    if (typeof base64 !== 'string') {
      throw new TypeError('base64 must be a string');
    }
    return new FodId(new owid(FodId.toStandardBase64(base64)));
  }

  /**
   * Parses a 51Did from the raw bytes of an OWID envelope.
   * @param {Uint8Array} buffer
   * @returns {FodId}
   */
  static fromByteArray (buffer) {
    if (!(buffer instanceof Uint8Array)) {
      throw new TypeError('buffer must be a Uint8Array');
    }
    return new FodId(new owid(Buffer.from(buffer).toString('base64')));
  }

  /**
   * Promotes an already-parsed owid instance into a 51Did. The constructor
   * **copies** the owid (re-parsed from its base64), not aliases it, so a
   * FodId can never desync from its envelope if the caller later mutates the
   * owid it passed in.
   * @param {object} owidInstance
   * @returns {FodId}
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
   * @returns {Uint8Array} a defensive copy of the value bytes (a 32-byte
   * SHA-256, or 16 GUID bytes for Random) - the stable cache / dedup key.
   */
  get hash () {
    return this._hash.slice();
  }

  /** @returns {number} the OWID version. */
  get version () {
    return this._owid.owid.version;
  }

  /** @returns {string} the domain of the OWID creator. */
  get domain () {
    return this._owid.domain;
  }

  /** @returns {number} the OWID date as minutes since 2020-01-01 UTC. */
  get date () {
    return this._owid.date;
  }

  /**
   * The envelope's own date as the unsigned 32-bit count of minutes since
   * 2020-01-01T00:00:00Z, exactly as the wire carries it. This is the value
   * the OWID `public-key?date=` parameter takes, and the integer to use when
   * comparing creation times. The OWID library reads the field as a signed
   * 32-bit number, so this getter forces the unsigned reading.
   * @returns {number} minutes since 2020-01-01T00:00:00Z
   */
  get dateMinutes () {
    return this._owid.date >>> 0;
  }

  /** @returns {Uint8Array} the OWID payload bytes. */
  get payload () {
    return this._owid.owid.payload;
  }

  /** @returns {Uint8Array} the 64-byte OWID signature. */
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
   * Verifies the OWID signature against the supplied SPKI public key PEM. This
   * is an explicit, separate step - construction never verifies. Asynchronous
   * because it uses Web Crypto.
   * @param {string} publicPem the creator public key in SPKI PEM form
   * @returns {Promise<boolean>}
   */
  verify (publicPem) {
    return this._owid.verifyWithPublicKey(publicPem, []);
  }
}

module.exports = FodId;
