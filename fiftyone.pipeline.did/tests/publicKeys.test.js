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

// The rule for choosing a published signing key for an identifier: the
// list read as the cloud publishes it, the entry in force at a moment, the
// entry for an identifier's date and the neighbours tried around a period
// boundary. DidClient is checked against the same rule in didClient.test.js.

const {
  FodId,
  FodIdParseError,
  PublicKeys,
  DidClient
} = require('../index');
const {
  canonicalPayload,
  envelopeBase64,
  generateKeyPair,
  publicPemOf,
  signedWith,
  minutesOf
} = require('./envelope');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const OWID_EPOCH_MS = Date.UTC(2020, 0, 1);

// Three weekly periods, Monday to Monday, as the cloud's generator writes.
const START_1 = new Date('2026-08-03T00:00:00Z');
const START_2 = new Date('2026-08-10T00:00:00Z');
const START_3 = new Date('2026-08-17T00:00:00Z');

/**
 * A schedule of three real key pairs and the JSON the key endpoint would
 * answer with, newest first so that the reader's ordering is exercised.
 * @returns {Promise<{pairs: object[], pems: string[], json: object[]}>}
 * the pairs, their public keys as PEM and the published list
 */
async function schedule () {
  const pairs = [
    await generateKeyPair(), await generateKeyPair(), await generateKeyPair()
  ];
  const pems = [
    await publicPemOf(pairs[0]),
    await publicPemOf(pairs[1]),
    await publicPemOf(pairs[2])
  ];
  const json = [
    { startsAt: START_3.toISOString(), weekStart: 'x', publicKey: pems[2] },
    { startsAt: START_1.toISOString(), weekStart: 'x', publicKey: pems[0] },
    { startsAt: START_2.toISOString(), weekStart: 'x', publicKey: pems[1] }
  ];
  return { pairs, pems, json };
}

/**
 * An identifier signed with the pair at the moment, as a FodId.
 * @param {object} pair the key pair to sign with
 * @param {Date} at the creation moment
 * @returns {Promise<FodId>} the identifier
 */
async function signedAt (pair, at) {
  return FodId.fromBase64(
    await signedWith(pair, canonicalPayload(), { date: minutesOf(at) }));
}

describe('PublicKeys.fromList', () => {
  test('reads startsAt and publicKey, oldest first, ignoring weekStart', async () => {
    const { pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
    expect(keys.map((k) => k.publicKey)).toEqual(pems);
    expect(keys[0]).not.toHaveProperty('weekStart');
  });

  test('reads created where startsAt is absent', async () => {
    const { json } = await schedule();
    const keys = PublicKeys.fromList(json.map((entry) => ({
      created: entry.startsAt, publicKey: entry.publicKey
    })));
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
  });

  test('reads a start given as a Date, as a stored list carries it', async () => {
    const { json } = await schedule();
    const keys = PublicKeys.fromList(
      json.map((entry) => ({
        startsAt: new Date(entry.startsAt), publicKey: entry.publicKey
      })));
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
  });

  test('the list and its entries are frozen', async () => {
    const { json } = await schedule();
    const keys = PublicKeys.fromList(json);
    expect(Object.isFrozen(keys)).toBe(true);
    expect(Object.isFrozen(keys[0])).toBe(true);
  });

  test('an empty list reads as an empty list', () => {
    expect(PublicKeys.fromList([])).toEqual([]);
  });

  test.each([
    [null],
    [undefined],
    ['[]'],
    [{ startsAt: START_1.toISOString(), publicKey: 'x' }]
  ])('refuses %p, which is not a list', (value) => {
    expect(() => PublicKeys.fromList(value)).toThrow(TypeError);
  });

  test.each([
    [{ publicKey: 'x' }],
    [{ startsAt: 'not a date', publicKey: 'x' }],
    [{ startsAt: START_1.toISOString() }],
    [{ startsAt: START_1.toISOString(), publicKey: '' }],
    [{ startsAt: START_1.toISOString(), publicKey: 42 }],
    [null]
  ])('refuses an entry %p that lacks a start or a key', (entry) => {
    expect(() => PublicKeys.fromList([entry])).toThrow(TypeError);
  });
});

describe('PublicKeys.createdAt', () => {
  test('is the envelope date turned back into a moment', async () => {
    const { pairs } = await schedule();
    const at = new Date(START_2.getTime() + 3 * DAY + 7 * MINUTE);
    const fodId = await signedAt(pairs[1], at);
    expect(PublicKeys.createdAt(fodId)).toEqual(at);
    expect(PublicKeys.createdAt(fodId).getTime())
      .toBe(OWID_EPOCH_MS + fodId.date * MINUTE);
  });

  test('accepts the base64 in either alphabet', async () => {
    const { pairs } = await schedule();
    const at = new Date(START_2.getTime() + DAY);
    const fodId = await signedAt(pairs[1], at);
    expect(PublicKeys.createdAt(fodId.asBase64())).toEqual(at);
    expect(PublicKeys.createdAt(fodId.asBase64Url())).toEqual(at);
  });

  test('refuses a string that is not a 51Did with the reader error', () => {
    expect(() => PublicKeys.createdAt('This is not valid Base64!@#'))
      .toThrow(FodIdParseError);
    expect(() => PublicKeys.createdAt(envelopeBase64(new Uint8Array(2))))
      .toThrow(RangeError);
  });

  test.each([[null], [undefined], [42], [{}]])(
    'refuses %p, which is neither an identifier nor a string', (value) => {
      expect(() => PublicKeys.createdAt(value)).toThrow(TypeError);
    });
});

describe('PublicKeys.inForceAt', () => {
  test('is the entry whose start is the latest on or before the moment', async () => {
    const { pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    expect(PublicKeys.inForceAt(keys, START_1).publicKey).toBe(pems[0]);
    expect(PublicKeys.inForceAt(keys, new Date(START_2.getTime() - 1))
      .publicKey).toBe(pems[0]);
    expect(PublicKeys.inForceAt(keys, START_2).publicKey).toBe(pems[1]);
    expect(PublicKeys.inForceAt(keys, new Date(START_3.getTime() + 30 * DAY))
      .publicKey).toBe(pems[2]);
  });

  test('is null before every entry', async () => {
    const { json } = await schedule();
    const keys = PublicKeys.fromList(json);
    expect(PublicKeys.inForceAt(keys, new Date(START_1.getTime() - 1)))
      .toBeNull();
    expect(PublicKeys.inForceAt([], START_2)).toBeNull();
  });

  test('takes the list in any order', async () => {
    const { pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const reversed = [...keys].reverse();
    expect(PublicKeys.inForceAt(reversed, new Date(START_2.getTime() + DAY))
      .publicKey).toBe(pems[1]);
  });

  test('refuses a list that was not read first', () => {
    expect(() => PublicKeys.inForceAt(
      [{ startsAt: START_1.toISOString(), publicKey: 'x' }], START_2))
      .toThrow(TypeError);
    expect(() => PublicKeys.inForceAt('keys', START_2)).toThrow(TypeError);
  });

  test('refuses a moment that is not a valid Date', async () => {
    const { json } = await schedule();
    const keys = PublicKeys.fromList(json);
    expect(() => PublicKeys.inForceAt(keys, new Date('nonsense')))
      .toThrow(TypeError);
    expect(() => PublicKeys.inForceAt(keys, START_2.getTime()))
      .toThrow(TypeError);
  });
});

describe('PublicKeys.inForceFor', () => {
  test('answers the key in force at the identifier date', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[1], new Date(START_2.getTime() + 3 * DAY));
    const key = PublicKeys.inForceFor(keys, fodId);
    expect(key.publicKey).toBe(pems[1]);
    expect(key.startsAt).toEqual(START_2);
  });

  test('accepts the base64 string too', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[0], new Date(START_1.getTime() + DAY));
    expect(PublicKeys.inForceFor(keys, fodId.asBase64Url()).publicKey)
      .toBe(pems[0]);
  });

  test('is null when the date precedes every entry', async () => {
    const { pairs, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const early = await signedAt(pairs[0], new Date(START_1.getTime() - DAY));
    expect(PublicKeys.inForceFor(keys, early)).toBeNull();
  });

  test('the newest entry answers for every later date', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const late = await signedAt(pairs[2], new Date(START_3.getTime() + 90 * DAY));
    expect(PublicKeys.inForceFor(keys, late).publicKey).toBe(pems[2]);
  });

  test('agrees with the client given the same list', async () => {
    const { pairs, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const client = new DidClient({
      resourceKey: 'AQTestResourceKey',
      endpoint: 'https://cloud.example/api/v4/',
      fetch: async () => ({ status: 200, text: async () => JSON.stringify(json) })
    });
    for (const at of [
      new Date(START_1.getTime() + DAY),
      new Date(START_2.getTime() - MINUTE),
      START_2,
      new Date(START_3.getTime() + 5 * DAY)
    ]) {
      const fodId = await signedAt(pairs[1], at);
      expect(PublicKeys.inForceFor(keys, fodId))
        .toEqual(await client.publicKeyFor(fodId));
    }
  });
});

describe('PublicKeys.candidatesFor', () => {
  test('is the entry in force alone away from a boundary', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[1], new Date(START_2.getTime() + 3 * DAY));
    expect(PublicKeys.candidatesFor(keys, fodId).map((k) => k.publicKey))
      .toEqual([pems[1]]);
  });

  test('adds the earlier entry in the minutes after a boundary', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[1], new Date(START_2.getTime() + 5 * MINUTE));
    expect(PublicKeys.candidatesFor(keys, fodId).map((k) => k.publicKey))
      .toEqual([pems[1], pems[0]]);
  });

  test('adds the later entry in the minutes before a boundary', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[0], new Date(START_2.getTime() - 5 * MINUTE));
    expect(PublicKeys.candidatesFor(keys, fodId).map((k) => k.publicKey))
      .toEqual([pems[0], pems[1]]);
  });

  test('never tries an entry older than the neighbour', async () => {
    const { pairs, pems, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[2], new Date(START_3.getTime() + 5 * MINUTE));
    const tried = PublicKeys.candidatesFor(keys, fodId).map((k) => k.publicKey);
    expect(tried).toEqual([pems[2], pems[1]]);
    expect(tried).not.toContain(pems[0]);
  });

  test('is empty when no entry covers the date', async () => {
    const { pairs, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const early = await signedAt(pairs[0], new Date(START_1.getTime() - DAY));
    expect(PublicKeys.candidatesFor(keys, early)).toEqual([]);
  });

  test('the first candidate is the one inForceFor answers', async () => {
    const { pairs, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[1], new Date(START_2.getTime() + 5 * MINUTE));
    expect(PublicKeys.candidatesFor(keys, fodId)[0])
      .toBe(PublicKeys.inForceFor(keys, fodId));
  });

  test('a signature checks against the candidate and no other', async () => {
    const { pairs, json } = await schedule();
    const keys = PublicKeys.fromList(json);
    const fodId = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    const [candidate] = PublicKeys.candidatesFor(keys, fodId);
    expect(await fodId.verify(candidate.publicKey)).toBe(true);
    expect(await fodId.verify(keys[0].publicKey)).toBe(false);
  });
});

describe('PublicKeys is part of the published surface', () => {
  test('is exported from the package entry point and frozen', () => {
    expect(Object.isFrozen(PublicKeys)).toBe(true);
    for (const name of [
      'fromList', 'createdAt', 'inForceAt', 'inForceFor', 'candidatesFor'
    ]) {
      expect(typeof PublicKeys[name]).toBe('function');
    }
  });
});
