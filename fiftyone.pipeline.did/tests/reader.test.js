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

const { FodId } = require('../index');
const { read, IdType, Usage } = require('../reader');
const { payloadOf } = require('../internal/envelope');
const {
  canonicalPayload,
  canonicalRandomPayload,
  payloadEndingAtMatchKey,
  randomPayloadEndingAtMatchKey,
  withTerms,
  withPayloadVersion,
  envelopeBytes,
  envelopeBase64
} = require('./envelope');
const layout = require('../internal/layout');

// Written out here rather than taken from the package, so that the test
// fails if the address the package answers with ever changes.
const MODEL_TERMS_2_URL = 'https://m4ow.uk/mtm/2.txt';
// An index added to the table after this package was released.
const UNKNOWN_INDEX = 200;

const USAGE_BITS = { nonMarketing: 0b001, standard: 0b011, personalized: 0b111 };
const TYPE_BITS = { probabilistic: 0b00, random: 0b01, hashedEmail: 0b10 };

// A payload ending at the match key for the type, with the flags byte set
// for the type, the usage and whether the usage was worked out indirectly.
function payloadFor (type, usage, indirect) {
  const payload = type === 'random'
    ? randomPayloadEndingAtMatchKey()
    : payloadEndingAtMatchKey();
  payload[layout.FLAGS_OFFSET] =
    (TYPE_BITS[type] << 6) | (indirect ? 0b1000 : 0) | USAGE_BITS[usage];
  return payload;
}

// Every type, usage and terms state an identifier can be in, as base 64.
function everyIdentifier () {
  const all = [];
  for (const type of Object.keys(TYPE_BITS)) {
    for (const usage of Object.keys(USAGE_BITS)) {
      for (const indirect of [false, true]) {
        const bare = payloadFor(type, usage, indirect);
        all.push(envelopeBase64(bare));
        for (const index of [0, 1, UNKNOWN_INDEX]) {
          all.push(envelopeBase64(withTerms(bare, index)));
          all.push(envelopeBase64(withTerms(bare, index, 12)));
        }
      }
    }
  }
  return all;
}

// Values that are not a 51Did, each for a different reason.
function everyRefusal () {
  const good = envelopeBytes(canonicalPayload());
  const base64 = (bytes) => Buffer.from(bytes).toString('base64');
  const noUsage = canonicalPayload();
  noUsage[layout.FLAGS_OFFSET] &= 0b11111000;
  const longDomain = 'a'.repeat(300);
  return [
    '',
    '   ',
    'not base 64 !!',
    base64(good.slice(0, good.length - 1)),
    base64(Uint8Array.from([...good, 0])),
    base64(good.slice(0, 5)),
    base64(Uint8Array.from([0, ...good.slice(1)])),
    base64(Uint8Array.from([4, ...good.slice(1)])),
    envelopeBase64(canonicalPayload(), { version: 1 }),
    envelopeBase64(canonicalPayload(), { domain: longDomain }),
    envelopeBase64(withPayloadVersion(canonicalPayload(), 1)),
    envelopeBase64(noUsage),
    envelopeBase64(canonicalPayload().slice(0, 4)),
    envelopeBase64(canonicalPayload().slice(0, 20)),
    envelopeBase64(canonicalRandomPayload().slice(0, 12)),
    envelopeBase64(new Uint8Array(0)),
    undefined,
    null,
    5,
    {},
    []
  ];
}

describe('reader', () => {
  it('answers as FodId does for every type, usage and terms state', () => {
    const identifiers = everyIdentifier();
    expect(identifiers).toHaveLength(126);
    for (const value of identifiers) {
      const full = FodId.tryParse(value);
      const facts = read(value);
      expect(full.ok).toBe(true);
      expect(facts).toEqual({
        ok: true,
        type: full.value.type,
        usage: full.value.usage,
        usageIsIndirect: full.value.usageIsIndirect,
        terms: full.value.terms
      });
    }
  });

  it('refuses whatever FodId refuses', () => {
    for (const value of everyRefusal()) {
      expect(FodId.tryParse(value).ok).toBe(false);
      expect(read(value)).toEqual({
        ok: false, type: null, usage: null, usageIsIndirect: null, terms: null
      });
    }
  });

  it('reads an OWID version 2 envelope as FodId does', () => {
    const value = envelopeBase64(withTerms(canonicalPayload(), 1), { version: 2 });
    expect(read(value).ok).toBe(FodId.tryParse(value).ok);
    expect(read(value).terms).toBe(FodId.tryParse(value).value.terms);
  });

  it('answers with the highest usage granted', () => {
    const usageOf = (usage) =>
      read(envelopeBase64(payloadFor('probabilistic', usage, false))).usage;
    expect(usageOf('nonMarketing')).toBe(Usage.NON_MARKETING);
    expect(usageOf('standard')).toBe(Usage.STANDARD);
    expect(usageOf('personalized')).toBe(Usage.PERSONALIZED);
  });

  it('answers with the type', () => {
    const typeOf = (type) =>
      read(envelopeBase64(payloadFor(type, 'standard', false))).type;
    expect(typeOf('probabilistic')).toBe(IdType.PROBABILISTIC);
    expect(typeOf('random')).toBe(IdType.RANDOM);
    expect(typeOf('hashedEmail')).toBe(IdType.HASHED_EMAIL);
  });

  it('answers with the address of the terms an identifier was created under', () => {
    const marketing = withTerms(payloadFor('probabilistic', 'standard', false), 1);
    expect(read(envelopeBase64(marketing)).terms).toBe(MODEL_TERMS_2_URL);
  });

  it('answers with no address where the identifier states no terms', () => {
    const bare = payloadFor('probabilistic', 'nonMarketing', false);
    expect(read(envelopeBase64(bare)).terms).toBeNull();
    expect(read(envelopeBase64(withTerms(bare, 0))).terms).toBeNull();
  });

  it('answers with no address for a terms index this package does not know', () => {
    const later = withTerms(payloadFor('random', 'standard', false), UNKNOWN_INDEX);
    const facts = read(envelopeBase64(later));
    expect(facts.ok).toBe(true);
    expect(facts.terms).toBeNull();
  });

  it('reads the URL safe alphabet, padded or not, as FodId does', () => {
    const standard = envelopeBase64(withTerms(canonicalPayload(), 1));
    const urlSafe = FodId.toBase64Url(standard);
    expect(urlSafe).not.toBe(standard);
    for (const value of [urlSafe, standard.replace(/=+$/, ''), ' ' + standard + ' ']) {
      expect(FodId.tryParse(value).ok).toBe(true);
      expect(read(value)).toEqual(read(standard));
    }
  });

  it('gives a frozen answer', () => {
    expect(Object.isFrozen(read(envelopeBase64(canonicalPayload())))).toBe(true);
    expect(Object.isFrozen(read('nonsense'))).toBe(true);
  });

  it('finds the payload the OWID library finds', () => {
    const payload = withTerms(canonicalPayload(), 1, 20);
    const value = envelopeBase64(payload);
    expect(Array.from(payloadOf(value)))
      .toEqual(Array.from(FodId.tryParse(value).value.payload));
  });

  it('answers as FodId does for base 64 that is written oddly', () => {
    const good = envelopeBase64(withTerms(canonicalPayload(), 1));
    const half = Math.floor(good.length / 2);
    const odd = [
      good.slice(0, half) + '\n' + good.slice(half),
      good.slice(0, half) + ' ' + good.slice(half),
      '\t' + good + '\r\n',
      good + '=',
      good.slice(0, half) + '*' + good.slice(half),
      good.slice(0, good.length - (good.length % 4) - 3),
      FodId.toBase64Url(good) + '==',
      'A'
    ];
    for (const value of odd) {
      const full = FodId.tryParse(value);
      const facts = read(value);
      expect(facts.ok).toBe(full.ok);
      expect(facts.terms).toBe(full.ok ? full.value.terms : null);
    }
  });

  it('reads each value afresh, so a payload handed back cannot change a later answer', () => {
    const value = envelopeBase64(withTerms(canonicalPayload(), 1));
    payloadOf(value).fill(0);
    expect(read(value).terms).toBe(MODEL_TERMS_2_URL);
  });

  it('loads without the OWID library', () => {
    jest.isolateModules(() => {
      jest.doMock('owid', () => {
        throw new Error('the reader must not load the OWID library');
      });
      const isolated = require('../reader');
      expect(isolated.read(envelopeBase64(withTerms(canonicalPayload(), 1))).terms)
        .toBe(MODEL_TERMS_2_URL);
    });
    jest.dontMock('owid');
  });
});
