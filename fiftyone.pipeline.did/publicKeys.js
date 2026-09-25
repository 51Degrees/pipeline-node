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

/** The OWID date field counts minutes from this moment. */
const OWID_EPOCH_MS = Date.UTC(2020, 0, 1);
const MINUTE_MS = 60 * 1000;

/**
 * How far either side of a period boundary the neighbouring key is also
 * tried. A creator rolls its signing key over at the start of a period and
 * the identifier's date is the creator's clock to the minute, so an
 * identifier made in the minutes around a boundary may carry the key from
 * either side of it.
 */
const BOUNDARY_TOLERANCE_MS = 15 * MINUTE_MS;

/**
 * A published signing key and the moment it came into force. A key stays in
 * force until the next key starts.
 * @typedef {object} PublicKeyEntry
 * @property {Date} startsAt when the key came, or comes, into force
 * @property {string} publicKey the key in SPKI PEM form
 */

/**
 * Choosing which published signing key an identifier was signed with, given
 * the key list the cloud publishes and nothing else. These are the rules
 * {@link DidClient} applies once it has fetched the list, offered on their
 * own so that a caller holding the list already, for example a page that
 * keeps it between visits, chooses a key the same way the client does and
 * never works the rule out for itself.
 *
 * The list is the answer of the cloud's `id/key/{resource}` endpoint, being
 * one entry per key with the moment the key came into force and the key in
 * SPKI PEM form. A key is in force from its start until the next entry's
 * start, so the entry for a moment is the one whose start is the latest on
 * or before it, and a moment before every start has no key.
 *
 * Nothing here fetches the list or checks a signature. {@link DidClient}
 * fetches, and {@link FodId#checkSignature} checks against the key chosen.
 */
const PublicKeys = Object.freeze({
  /**
   * Reads the key list as the cloud's `id/key/{resource}` endpoint answers
   * it, or as a caller stored it, into entries ordered oldest start first.
   * Each entry must carry the key as `publicKey` and its start as
   * `startsAt`, or as `created` where the entry carries no `startsAt`, both
   * as a date string or a Date. Any other field, `weekStart` included, is
   * ignored. The entries and the list are frozen.
   * @param {Array<object>} entries the list as published or as stored
   * @returns {ReadonlyArray<PublicKeyEntry>} the entries, oldest first
   * @throws {TypeError} when the value is not an array, or an entry lacks a
   * readable start or a public key
   */
  fromList (entries) {
    if (!Array.isArray(entries)) {
      throw new TypeError('entries must be an array of published keys');
    }
    const keys = entries.map((entry) => {
      const start = entry && (entry.startsAt || entry.created);
      const startsAt = start instanceof Date
        ? new Date(start.getTime())
        : typeof start === 'string' ? new Date(start) : null;
      if (startsAt === null || isNaN(startsAt.getTime()) ||
        typeof entry.publicKey !== 'string' || entry.publicKey.length === 0) {
        throw new TypeError(
          'Public keys entry lacks a start or a publicKey: ' +
          JSON.stringify(entry));
      }
      return Object.freeze({ startsAt, publicKey: entry.publicKey });
    });
    keys.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return Object.freeze(keys);
  },

  /**
   * The moment an identifier was created, as a Date, being the envelope's
   * date field turned back from minutes since 2020-01-01T00:00:00Z. This is
   * the moment the key for the identifier is chosen at.
   * @param {FodId | string} fodId the identifier, or its base64 in either
   * alphabet
   * @returns {Date} the creation moment
   * @throws {TypeError} when the value is neither a FodId nor a string
   * @throws {FodIdParseError} when a string is not an OWID
   * @throws {RangeError} when a string is an OWID that is not a 51Did
   */
  createdAt (fodId) {
    return new Date(OWID_EPOCH_MS + asFodId(fodId).date * MINUTE_MS);
  },

  /**
   * The entry in force at a moment, being the one whose start is the latest
   * on or before it, or null when the moment precedes every entry.
   * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
   * @param {Date} at the moment
   * @returns {PublicKeyEntry | null} the entry in force
   * @throws {TypeError} when the list is not an array of entries, or the
   * moment is not a valid Date
   */
  inForceAt (keys, at) {
    return inForceAt(asKeys(keys), asMoment(at));
  },

  /**
   * The entry in force when the identifier was created, or null when its
   * date precedes every entry in the list. The same rule as
   * {@link DidClient#publicKeyFor}, applied to a list the caller holds.
   * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
   * @param {FodId | string} fodId the identifier, or its base64 in either
   * alphabet
   * @returns {PublicKeyEntry | null} the entry in force
   * @throws {TypeError} when the list is not an array of entries, or the
   * identifier is neither a FodId nor a string
   * @throws {FodIdParseError} when a string is not an OWID
   * @throws {RangeError} when a string is an OWID that is not a 51Did
   */
  inForceFor (keys, fodId) {
    return inForceAt(asKeys(keys), PublicKeys.createdAt(fodId));
  },

  /**
   * The entries that may have signed the identifier, best first: the entry
   * in force when it was created, then the entry in force fifteen minutes
   * earlier and the one in force fifteen minutes later, where those differ.
   * A signature is checked against these in order and no earlier key is
   * tried, which is the rule {@link DidClient#verifySignature} applies. An
   * empty list means no published key covers the identifier's date.
   * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
   * @param {FodId | string} fodId the identifier, or its base64 in either
   * alphabet
   * @returns {PublicKeyEntry[]} the entries to try, best first, at most three
   * @throws {TypeError} when the list is not an array of entries, or the
   * identifier is neither a FodId nor a string
   * @throws {FodIdParseError} when a string is not an OWID
   * @throws {RangeError} when a string is an OWID that is not a 51Did
   */
  candidatesFor (keys, fodId) {
    return candidatesAt(asKeys(keys), PublicKeys.createdAt(fodId));
  }
});

/**
 * The identifier as a FodId, reading a base64 string with the throwing
 * surface so a value that is not a 51Did is refused with the reader's own
 * error.
 * @param {FodId | string} value an identifier or its base64
 * @returns {FodId} the identifier
 */
function asFodId (value) {
  if (value instanceof FodId) {
    return value;
  }
  if (typeof value === 'string') {
    return FodId.fromBase64(value);
  }
  throw new TypeError('fodId must be a FodId or a base64 string');
}

/**
 * The list checked to be an array of entries carrying a start and a key.
 * @param {ReadonlyArray<PublicKeyEntry>} keys the list as given
 * @returns {ReadonlyArray<PublicKeyEntry>} the same list
 */
function asKeys (keys) {
  if (!Array.isArray(keys)) {
    throw new TypeError('keys must be an array of published key entries');
  }
  for (const key of keys) {
    if (!key || !(key.startsAt instanceof Date) ||
      isNaN(key.startsAt.getTime()) || typeof key.publicKey !== 'string') {
      throw new TypeError(
        'Each key needs a startsAt Date and a publicKey string. Read the ' +
        'published list with PublicKeys.fromList first.');
    }
  }
  return keys;
}

/**
 * The moment checked to be a valid Date.
 * @param {Date} at the moment as given
 * @returns {Date} the same moment
 */
function asMoment (at) {
  if (!(at instanceof Date) || isNaN(at.getTime())) {
    throw new TypeError('at must be a valid Date');
  }
  return at;
}

/**
 * The entry in force at the moment, being the newest whose start has
 * passed, or null when the moment precedes every entry.
 * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
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
 * and the entry in force a tolerance later where those differ. Not every
 * earlier entry.
 * @param {ReadonlyArray<PublicKeyEntry>} keys the list, in any order
 * @param {Date} at the moment
 * @returns {PublicKeyEntry[]} the entries to try, best first
 */
function candidatesAt (keys, at) {
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

module.exports = PublicKeys;
