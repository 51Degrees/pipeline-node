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
const { FodId, FodIdParseError, IdType, Usage } = require('../index');
// The named value is internal to the package and is not exported, so the
// table test below reaches the module directly rather than through the
// package entry point.
const Terms = require('../terms');
const {
  DOMAIN,
  DATE,
  CANONICAL_FLAGS,
  CANONICAL_LICENSE_ID,
  DUMMY_SIG,
  canonicalMatchKey,
  canonicalPayload,
  canonicalRandomPayload,
  payloadEndingAtMatchKey,
  randomPayloadEndingAtMatchKey,
  withTerms,
  withPayloadVersion,
  envelopeBytes,
  envelopeBase64,
  signedVerifiable,
  randomPublicPem
} = require('./envelope');
const layout = require('../internal/layout');

const { ParseStatus, SignatureStatus } = FodId;

// Written out here rather than taken from the package, so that the test
// fails if the address the package answers with ever changes. An index is
// never repointed once published, because repointing one would rewrite what
// a past identifier says it agreed to.
const MODEL_TERMS_2_URL = 'https://m4ow.uk/mtm/2.txt';
// An index added to the table after this package was released.
const UNKNOWN_INDEX = 200;

describe('FodId', () => {
  // ----- Current .NET coverage -----

  test('the internal layout constants are consistent', () => {
    expect(layout.MATCH_KEY_OFFSET + layout.MATCH_KEY_LENGTH)
      .toBe(layout.PAYLOAD_LENGTH);
    expect(layout.LICENSE_ID_OFFSET + layout.LICENSE_ID_LENGTH)
      .toBe(layout.MATCH_KEY_OFFSET);
    expect(layout.FLAGS_OFFSET + 1).toBe(layout.LICENSE_ID_OFFSET);
    expect(layout.MATCH_KEY_OFFSET).toBe(layout.HEADER_LENGTH);
    expect(layout.MATCH_KEY_OFFSET + layout.GUID_LENGTH)
      .toBe(layout.RANDOM_PAYLOAD_LENGTH);
  });

  test('the layout is not part of the public surface', () => {
    // The offsets are the way back to reading a named field by hand, so
    // nothing about them is reachable through the package entry point.
    const published = require('../index');
    for (const name of Object.keys(layout)) {
      expect(FodId[name]).toBeUndefined();
      expect(published[name]).toBeUndefined();
    }
    expect(published.layout).toBeUndefined();
  });

  test('exposes OWID-level fields', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    // OWID-level concerns are delegated to the wrapped envelope.
    expect(fod.domain).toBe(DOMAIN);
    expect(fod.version).toBeDefined();
  });

  test('fromBase64 unpacks all three fields', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.domain).toBe(DOMAIN);
  });

  test('fromByteArray unpacks all three fields', () => {
    const fod = FodId.fromByteArray(envelopeBytes(canonicalPayload()));
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.domain).toBe(DOMAIN);
  });

  test('fromOwid unpacks all three fields', () => {
    // An OWID reaches a caller only from a successful owid.parse.
    const o = owid.parse(envelopeBase64(canonicalPayload())).owid;
    const fod = FodId.fromOwid(o);
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.domain).toBe(o.domain);
    expect(fod.date).toBe(o.date);
    expect(fod.version).toBe(o.version);
    expect(fod.payload).toEqual(o.payload);
    expect(fod.signature).toEqual(o.signature);
  });

  test('null owid throws', () => {
    expect(() => FodId.fromOwid(null)).toThrow(TypeError);
    expect(() => FodId.fromOwid(undefined)).toThrow(TypeError);
    // An object that merely looks like an OWID carries no base64 to read.
    expect(() => FodId.fromOwid({ version: 3 })).toThrow(TypeError);
  });

  test('licenseId is little-endian', () => {
    const p = canonicalPayload();
    p[1] = 0x01; p[2] = 0x00; p[3] = 0x00; p[4] = 0x00;
    expect(FodId.fromBase64(envelopeBase64(p)).licenseId).toBe(1);
  });

  test('licenseId max value', () => {
    const p = canonicalPayload();
    p[1] = 0xFF; p[2] = 0xFF; p[3] = 0xFF; p[4] = 0xFF;
    expect(FodId.fromBase64(envelopeBase64(p)).licenseId).toBe(4294967295);
  });

  test('licenseId high bit stays unsigned', () => {
    const p = canonicalPayload();
    p[1] = 0x00; p[2] = 0x00; p[3] = 0x00; p[4] = 0x80;
    expect(FodId.fromBase64(envelopeBase64(p)).licenseId).toBe(0x80000000);
  });

  test('a flags byte of zero is read unchanged', () => {
    const p = canonicalPayload();
    p[layout.FLAGS_OFFSET] = 0x00;
    expect(FodId.fromBase64(envelopeBase64(p))._flags).toBe(0);
  });

  test('every flags bit outside the version is read unchanged', () => {
    // Bits 4 and 5 are the payload version and only version 0 is read, so
    // every other bit is set and those two are left clear. A payload with
    // them set is refused rather than read, which the version tests cover.
    const p = canonicalPayload();
    p[layout.FLAGS_OFFSET] = 0xCF;
    expect(FodId.fromBase64(envelopeBase64(p))._flags).toBe(0xCF);
  });

  test('matchKey is a defensive copy', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    const k = fod.matchKey;
    k[0] = 0x00;
    k[layout.MATCH_KEY_LENGTH - 1] = 0x00;
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.payload[layout.MATCH_KEY_OFFSET]).toBe(0x20);
  });

  test('payload one byte short throws', () => {
    expect(() => FodId.fromBase64(envelopeBase64(new Uint8Array(layout.PAYLOAD_LENGTH - 1))))
      .toThrow(RangeError);
  });

  test('empty payload throws', () => {
    expect(() => FodId.fromBase64(envelopeBase64(new Uint8Array(0))))
      .toThrow(RangeError);
  });

  test('null base64 throws', () => {
    expect(() => FodId.fromBase64(null)).toThrow(TypeError);
  });

  test('null buffer throws', () => {
    expect(() => FodId.fromByteArray(null)).toThrow(TypeError);
  });

  test('invalid base64 throws', () => {
    expect(() => FodId.fromBase64('This is not valid Base64!@#$'))
      .toThrow(FodIdParseError);
  });

  test('payload larger than spec uses first 37 bytes', () => {
    const p = new Uint8Array(64);
    p.set(canonicalPayload());
    p.fill(0xCC, layout.PAYLOAD_LENGTH);
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.matchKey.length).toBe(layout.MATCH_KEY_LENGTH);
  });

  test('a long context section and a long creator domain both parse', () => {
    // The creator domain is a deployment parameter, so a self-hosted
    // container may sign with a longer one, and a context section of a
    // version this reader does not implement may be longer still. Both
    // must parse and leave the judgement to the cloud.
    const p = new Uint8Array(layout.PAYLOAD_LENGTH + 400);
    p.set(canonicalPayload());
    p.fill(0xCC, layout.PAYLOAD_LENGTH);
    const bytes = envelopeBytes(p, {
      domain: 'a-self-hosted-container.example.internal.51degrees.com'
    });
    const encoded = Buffer.from(bytes).toString('base64');

    for (const fod of [
      FodId.fromBase64(encoded),
      FodId.fromByteArray(bytes),
      FodId.fromOwid(owid.parse(encoded).owid),
      FodId.tryParse(encoded).value,
      FodId.tryFromByteArray(bytes).value
    ]) {
      expect(fod._flags).toBe(CANONICAL_FLAGS);
      expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
      expect(fod.matchKey).toEqual(canonicalMatchKey());
      expect(fod.payload).toHaveLength(p.length);
    }
  });

  test('surrounding whitespace parses to the same value', () => {
    const clean = envelopeBase64(canonicalPayload());
    const expected = FodId.fromBase64(clean);
    for (const spaced of [
      clean + '\n', ' ' + clean, clean + ' ', ' \r\n\t' + clean + ' \r\n\t',
      FodId.toBase64Url(clean) + '\n', ' ' + FodId.toBase64Url(clean) + ' '
    ]) {
      const fod = FodId.fromBase64(spaced);
      expect(fod.asBase64()).toBe(expected.asBase64());
      expect(fod.matchKey).toEqual(expected.matchKey);
      expect(fod.licenseId).toBe(expected.licenseId);
      expect(fod._flags).toBe(expected._flags);
    }
  });

  test('is cryptographically verifiable', async () => {
    const { base64, publicPem } = await signedVerifiable(canonicalPayload());
    const fod = FodId.fromBase64(base64);
    await expect(fod.verify(publicPem)).resolves.toBe(true);
    await expect(fod.checkSignature(publicPem)).resolves.toMatchObject({
      ok: true, status: SignatureStatus.SIGNATURE_VALID
    });
  });

  test('base64 round-trip preserves all fields', () => {
    const fod1 = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    const fod2 = FodId.fromBase64(fod1.asBase64());
    expect(fod2._flags).toBe(fod1._flags);
    expect(fod2.licenseId).toBe(fod1.licenseId);
    expect(fod2.matchKey).toEqual(fod1.matchKey);
    expect(fod2.domain).toBe(fod1.domain);
  });

  // ----- Type model -----

  test('type decoded from top two flag bits', () => {
    expect(typeFor(0b0000_0101)).toBe(IdType.PROBABILISTIC);
    expect(typeFor(0b1000_0101)).toBe(IdType.HASHED_EMAIL);
    expect(typeFor(0b1100_0101)).toBe(IdType.RESERVED);
  });

  function typeFor (flags) {
    const p = canonicalPayload();
    p[layout.FLAGS_OFFSET] = flags;
    return FodId.fromBase64(envelopeBase64(p)).type;
  }

  // The usage is the highest granted, because the bits are cumulative. A
  // mask for the non-marketing bit alone would say yes for every marketing
  // identifier, which is the wrong answer for a data protection decision.
  test.each([
    [0b000, Usage.NONE, null],
    [0b001, Usage.NON_MARKETING, 'non-marketing'],
    [0b011, Usage.STANDARD, 'standard'],
    [0b111, Usage.PERSONALIZED, 'personalized']
  ])('usage bits %s read as the highest granted', (bits, expected, idUsage) => {
    const p = canonicalRandomPayload();
    p[layout.FLAGS_OFFSET] = (1 << 6) | bits;
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.usage).toBe(expected);
    expect(Usage.idUsage(fod.usage)).toBe(idUsage);
    expect(fod.type).toBe(IdType.RANDOM);
    expect(fod.usageFromConsent).toBe(false);
  });

  test('usage from consent is bit three', () => {
    const p = canonicalRandomPayload();
    p[layout.FLAGS_OFFSET] = (1 << 6) | 0b1011;
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.usageFromConsent).toBe(true);
    expect(fod.usage).toBe(Usage.STANDARD);
  });

  test('type is Random when bits are 01', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalRandomPayload()));
    expect(fod.type).toBe(IdType.RANDOM);
  });

  test('Random 21-byte payload parses', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalRandomPayload()));
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey.length).toBe(layout.GUID_LENGTH);
    const guid = new Uint8Array(layout.GUID_LENGTH);
    for (let i = 0; i < guid.length; i++) { guid[i] = 0x40 + i; }
    expect(fod.matchKey).toEqual(guid);
  });

  test('Random payload one byte short throws', () => {
    const p = canonicalRandomPayload().slice(0, layout.RANDOM_PAYLOAD_LENGTH - 1);
    expect(() => FodId.fromBase64(envelopeBase64(p))).toThrow(RangeError);
  });

  test('Random payload larger than spec uses first 16 value bytes', () => {
    const p = new Uint8Array(layout.PAYLOAD_LENGTH);
    p.set(canonicalRandomPayload());
    p.fill(0xCC, layout.RANDOM_PAYLOAD_LENGTH);
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.type).toBe(IdType.RANDOM);
    expect(fod.matchKey.length).toBe(layout.GUID_LENGTH);
  });

  test('HashedEmail payload one byte short throws', () => {
    const p = canonicalPayload().slice(0, layout.PAYLOAD_LENGTH - 1);
    expect(() => FodId.fromBase64(envelopeBase64(p))).toThrow(RangeError);
  });

  test('Reserved header-only payload parses', () => {
    const p = new Uint8Array(layout.MATCH_KEY_OFFSET);
    p[layout.FLAGS_OFFSET] = 0b1100_0000;
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.type).toBe(IdType.RESERVED);
    expect(fod.matchKey.length).toBe(0);
  });

  // ----- Terms -----

  // The terms document the identifier was created under, carried in the
  // byte after the match key. Absence and zero are the same answer, and an
  // index this package does not know is neither of them.

  test('a payload ending at the match key answers with no address', () => {
    // There is no byte after the match key to read, so the reader answers
    // zero and everything else about the identifier reads as it does when
    // the byte is present.
    const fod = FodId.fromBase64(
      envelopeBase64(payloadEndingAtMatchKey()));
    expect(fod.terms).toBeNull();
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
  });

  test('terms index one is the Model Terms for Marketing address', () => {
    const fod = FodId.fromBase64(
      envelopeBase64(withTerms(payloadEndingAtMatchKey(), 1)));
    expect(fod.terms).toBe(MODEL_TERMS_2_URL);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
  });

  test('an index this package does not know has no address', () => {
    // No address is ever built from an index the package cannot name,
    // because that would name a document nobody wrote and a receiver
    // would record having accepted terms that do not exist.
    for (const index of [2, 127, UNKNOWN_INDEX, 255]) {
      const fod = FodId.fromBase64(
        envelopeBase64(withTerms(payloadEndingAtMatchKey(), index)));
      expect(fod.terms).toBeNull();
      expect(fod.terms).not.toBe('');
    }
  });

  test('not stated and an unknown index both answer with no address',
    () => {
      // A caller cannot tell the two apart, which is deliberate, since
      // both say the identifier does not give the terms and the answer
      // has to come from somewhere else.
      const notStated = FodId.fromBase64(
        envelopeBase64(withTerms(payloadEndingAtMatchKey(), 0)));
      const unknown = FodId.fromBase64(
        envelopeBase64(withTerms(payloadEndingAtMatchKey(), UNKNOWN_INDEX)));
      expect(notStated.terms).toBeNull();
      expect(unknown.terms).toBeNull();
    });

  test('a zero terms byte written out reads the same as none at all', () => {
    const written = FodId.fromBase64(
      envelopeBase64(withTerms(payloadEndingAtMatchKey(), 0)));
    const absent = FodId.fromBase64(
      envelopeBase64(payloadEndingAtMatchKey()));
    expect(written.terms).toBe(absent.terms);
    expect(written.terms).toBeNull();
  });

  // The byte follows the match key, so its offset comes from the identifier
  // type. Reading it at a fixed offset would read a context byte on one
  // type and the wrong end of the match key on the other.
  test.each([
    ['a 32 byte match key', payloadEndingAtMatchKey,
      layout.MATCH_KEY_LENGTH],
    ['a 16 byte match key', randomPayloadEndingAtMatchKey,
      layout.GUID_LENGTH]
  ])('the terms byte is read after %s', (name, build, matchKeyLength) => {
    const bare = FodId.fromBase64(envelopeBase64(build()));
    expect(bare.matchKey.length).toBe(matchKeyLength);
    expect(bare.terms).toBeNull();

    for (const [index, url] of [
      [0, null],
      [1, MODEL_TERMS_2_URL],
      [UNKNOWN_INDEX, null]
    ]) {
      const fod = FodId.fromBase64(envelopeBase64(withTerms(build(), index)));
      expect(fod.matchKey).toEqual(bare.matchKey);
      expect(fod.matchKey.length).toBe(matchKeyLength);
      expect(fod.terms).toBe(url);
    }
  });

  test.each([
    ['a 32 byte match key', payloadEndingAtMatchKey],
    ['a 16 byte match key', randomPayloadEndingAtMatchKey]
  ])('a context section after the terms byte leaves it read, with %s',
    (name, build) => {
      // The byte sits before the creator context, so a payload carrying
      // both proves the byte is read at its own offset rather than at the
      // end of whatever the payload holds.
      const p = withTerms(build(), 1, 96);
      const bytes = envelopeBytes(p);
      const encoded = Buffer.from(bytes).toString('base64');
      const bare = FodId.fromBase64(envelopeBase64(build()));

      for (const fod of [
        FodId.fromBase64(encoded),
        FodId.fromByteArray(bytes),
        FodId.fromOwid(owid.parse(encoded).owid),
        FodId.tryParse(encoded).value,
        FodId.tryFromByteArray(bytes).value
      ]) {
        expect(fod.matchKey).toEqual(bare.matchKey);
        expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
        expect(fod.terms).toBe(MODEL_TERMS_2_URL);
        expect(fod.payload).toHaveLength(p.length);
      }
    });

  test('a Reserved payload answers with no address', () => {
    // A Reserved type is not yet assigned, so everything after the header
    // is exposed as the match key and no byte is left to read as the terms.
    const p = new Uint8Array(layout.MATCH_KEY_OFFSET);
    p[layout.FLAGS_OFFSET] = 0b1100_0000;
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.type).toBe(IdType.RESERVED);
    expect(fod.terms).toBeNull();
  });

  test('the terms survive both base64 alphabets and the byte round-trip',
    () => {
      const p = withTerms(payloadEndingAtMatchKey(), 1);
      const first = FodId.fromBase64(envelopeBase64(p));
      for (const again of [
        FodId.fromBase64(first.asBase64()),
        FodId.fromBase64(first.asBase64Url()),
        FodId.fromByteArray(first.asByteArray())
      ]) {
        expect(again.terms).toBe(first.terms);
        expect(again.terms).toBe(MODEL_TERMS_2_URL);
      }
    });

  test('every row of the Terms table agrees with itself', () => {
    // The row carries the name and the address together, so this fails if
    // a later change puts either somewhere else and the two disagree, or
    // if a row is added without an address.
    for (let index = 0; index < 256; index++) {
      const terms = Terms.fromIndex(index);
      const name = Terms.name(terms);
      const url = Terms.url(terms);
      if (terms === Terms.UNKNOWN) {
        expect(name).toBe('Unknown');
        expect(url).toBeNull();
        continue;
      }
      // A row is reached by its own index and answers a name.
      expect(terms).toBe(index);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      if (index === Terms.NOT_STATED) {
        // Names no document, so it has no address.
        expect(url).toBeNull();
      } else {
        expect(typeof url).toBe('string');
        expect(url.startsWith('https://')).toBe(true);
      }
    }
  });

  test('the Terms table maps every index, name and address', () => {
    expect(Terms.fromIndex(0)).toBe(Terms.NOT_STATED);
    expect(Terms.fromIndex(1)).toBe(Terms.MODEL_TERMS_FOR_MARKETING_2);
    expect(Terms.fromIndex(2)).toBe(Terms.UNKNOWN);
    expect(Terms.fromIndex(UNKNOWN_INDEX)).toBe(Terms.UNKNOWN);
    expect(Terms.fromIndex(255)).toBe(Terms.UNKNOWN);
    expect(Terms.name(Terms.NOT_STATED)).toBe('NotStated');
    expect(Terms.name(Terms.MODEL_TERMS_FOR_MARKETING_2))
      .toBe('ModelTermsForMarketing2');
    expect(Terms.name(Terms.UNKNOWN)).toBe('Unknown');
    expect(Terms.url(Terms.NOT_STATED)).toBeNull();
    expect(Terms.url(Terms.MODEL_TERMS_FOR_MARKETING_2))
      .toBe(MODEL_TERMS_2_URL);
    expect(Terms.url(Terms.UNKNOWN)).toBeNull();
    expect(Object.isFrozen(Terms)).toBe(true);
    // The named value is internal, so the package entry point does not
    // offer it. The address on FodId is the whole of the surface.
    expect(require('../index').Terms).toBeUndefined();
  });

  // ----- The payload version -----

  // Bits 4 and 5 of the flags byte say which payload layout the identifier
  // follows. This package reads version 0 and refuses every other version
  // rather than reading fields that may have moved.

  test('a flags byte with the version bits clear reads every field', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    expect(fod.type).toBe(IdType.HASHED_EMAIL);
    expect(fod.usage).toBe(Usage.PERSONALIZED);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.terms).toBe(MODEL_TERMS_2_URL);
  });

  test.each([[1], [2], [3]])(
    'payload version %i is refused and names the version', (version) => {
      const p = withPayloadVersion(canonicalPayload(), version);
      const read = FodId.tryParse(envelopeBase64(p));

      expect(read.ok).toBe(false);
      expect(read.status).toBe(ParseStatus.UNSUPPORTED_PAYLOAD_VERSION);
      // Nothing is handed back, rather than a value with some fields
      // filled in, because there is no identifier to expose fields for
      // when the layout was not understood.
      expect(read.value).toBeNull();

      let thrown = null;
      try {
        FodId.fromBase64(envelopeBase64(p));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).not.toBeNull();
      expect(thrown.status).toBe(ParseStatus.UNSUPPORTED_PAYLOAD_VERSION);
      expect(thrown.message).toContain(`version ${version}`);
    });

  test('the version is read apart from the usage and type bits', () => {
    // A reader masking the wrong bits would refuse a version 0 identifier
    // or let a later version through, so every combination is tried.
    for (const usage of [0b000, 0b001, 0b011, 0b111]) {
      for (const type of [0b00, 0b10, 0b11]) {
        const p = payloadEndingAtMatchKey();
        p[layout.FLAGS_OFFSET] = (type << 6) | usage;

        expect(FodId.tryParse(envelopeBase64(p)).ok).toBe(true);

        for (const version of [1, 2, 3]) {
          const refused = FodId.tryParse(
            envelopeBase64(withPayloadVersion(p, version)));
          expect(refused.status)
            .toBe(ParseStatus.UNSUPPORTED_PAYLOAD_VERSION);
          expect(refused.value).toBeNull();
        }
      }
    }
  });

  test('reading the address does not fetch it', () => {
    // The package answers with the address and never fetches it, because
    // what to do with the document is the caller's decision.
    const before = globalThis.fetch;
    const calls = [];
    globalThis.fetch = (...args) => {
      calls.push(args);
      return Promise.reject(new Error('a read must not fetch'));
    };
    try {
      const fod = FodId.fromBase64(
        envelopeBase64(withTerms(payloadEndingAtMatchKey(), 1)));
      expect(fod.terms).toBe(MODEL_TERMS_2_URL);
    } finally {
      globalThis.fetch = before;
    }
    expect(calls).toHaveLength(0);
  });

  // ----- Gap tests (runbook section 6b) -----

  test('compare two 51Dids over the same payload', () => {
    const payload = canonicalPayload();
    const sigB = DUMMY_SIG.map((b) => b ^ 0xFF);
    const a = envelopeBase64(payload, { date: DATE, signature: DUMMY_SIG });
    const b = envelopeBase64(payload, { date: DATE + 5, signature: sigB });
    const fa = FodId.fromBase64(a);
    const fb = FodId.fromBase64(b);

    expect(fa.matchKey).toEqual(fb.matchKey); // match key is stable
    expect(fa.date).not.toBe(fb.date); // envelope differs
    expect(fa.signature).not.toEqual(fb.signature);
    expect(a).not.toBe(b);
  });

  test('construction does not verify', () => {
    // An envelope with a bogus signature still constructs and exposes all
    // three fields - construction must not verify.
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
  });

  test('fromOwid is decoupled from the source owid', () => {
    // The OWID library hands out a frozen OWID whose payload is a fresh
    // copy on every read, so writing into what a caller holds changes
    // neither the OWID nor the FodId built from it.
    const o = owid.parse(envelopeBase64(canonicalPayload())).owid;
    const fod = FodId.fromOwid(o);
    expect(Object.isFrozen(o)).toBe(true);
    o.payload[layout.MATCH_KEY_OFFSET] = 0x00; // writes into a copy
    expect(o.payload[layout.MATCH_KEY_OFFSET]).toBe(0x20);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.payload[layout.MATCH_KEY_OFFSET]).toBe(0x20);
  });

  test('constructor is decoupled from the source owid', () => {
    // The constructor reads the OWID's base64 again rather than aliasing
    // the instance, so the FodId holds its own OWID.
    const o = owid.parse(envelopeBase64(canonicalPayload())).owid;
    const fod = new FodId(o);
    expect(fod._owid).not.toBe(o);
    fod.payload[layout.MATCH_KEY_OFFSET] = 0x00; // writes into a copy
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod._flags).toBe(CANONICAL_FLAGS);
    expect(fod.payload[layout.MATCH_KEY_OFFSET]).toBe(0x20);
  });

  test('verify with the wrong key returns false', async () => {
    const { base64 } = await signedVerifiable(canonicalPayload());
    const otherPublicPem = await randomPublicPem();
    const fod = FodId.fromBase64(base64);
    await expect(fod.verify(otherPublicPem)).resolves.toBe(false);
  });

  test('round-trip through the bytes constructor preserves all fields', () => {
    const fod1 = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    const fod2 = FodId.fromByteArray(fod1.asByteArray());
    expect(fod2._flags).toBe(fod1._flags);
    expect(fod2.licenseId).toBe(fod1.licenseId);
    expect(fod2.matchKey).toEqual(fod1.matchKey);
    expect(fod2.domain).toBe(fod1.domain);
  });

  // ----- Both base64 alphabets -----

  // A payload whose envelope base64 contains both characters that differ
  // between the alphabets, so the URL-safe form is a real conversion.
  function alphabetPayload () {
    const p = canonicalPayload();
    // 0xFB 0xFF 0xBF encodes to "+/+/" in standard base64.
    p[layout.MATCH_KEY_OFFSET] = 0xFB;
    p[layout.MATCH_KEY_OFFSET + 1] = 0xFF;
    p[layout.MATCH_KEY_OFFSET + 2] = 0xBF;
    return p;
  }

  test('fromBase64 accepts the standard, URL-safe and unpadded forms', () => {
    const standard = envelopeBase64(alphabetPayload());
    expect(standard).toMatch(/[+/]/);
    expect(standard).toMatch(/=$/);
    const urlSafePadded = standard.replace(/\+/g, '-').replace(/\//g, '_');
    const urlSafe = urlSafePadded.replace(/=+$/, '');
    expect(urlSafe).not.toMatch(/[+/=]/);

    const a = FodId.fromBase64(standard);
    const b = FodId.fromBase64(urlSafePadded);
    const c = FodId.fromBase64(urlSafe);
    for (const fod of [b, c]) {
      expect(fod._flags).toBe(a._flags);
      expect(fod.licenseId).toBe(a.licenseId);
      expect(fod.matchKey).toEqual(a.matchKey);
      expect(fod.date).toBe(a.date);
      expect(fod.signature).toEqual(a.signature);
      // Held in the standard form whichever form was given.
      expect(fod.asBase64()).toBe(standard);
    }
  });

  test('asBase64Url round-trips', () => {
    const standard = envelopeBase64(alphabetPayload());
    const fod = FodId.fromBase64(standard);
    const url = fod.asBase64Url();
    expect(url).not.toMatch(/[+/=]/);
    expect(url).toBe(FodId.toBase64Url(standard));
    expect(FodId.toStandardBase64(url)).toBe(standard);
    const back = FodId.fromBase64(url);
    expect(back.asBase64()).toBe(standard);
    expect(back.matchKey).toEqual(fod.matchKey);
  });

  test('toStandardBase64 pads by length', () => {
    expect(FodId.toStandardBase64('QQ')).toBe('QQ==');
    expect(FodId.toStandardBase64('QUI')).toBe('QUI=');
    expect(FodId.toStandardBase64('QUJD')).toBe('QUJD');
    expect(FodId.toStandardBase64('-_8')).toBe('+/8=');
    expect(() => FodId.toStandardBase64(null)).toThrow(TypeError);
    expect(() => FodId.toBase64Url(null)).toThrow(TypeError);
  });

  // ----- Date -----

  test('date equals the envelope date field', () => {
    const fod = FodId.fromBase64(
      envelopeBase64(canonicalPayload(), { date: DATE }));
    expect(fod.date).toBe(DATE);
  });

  test('date is unsigned', () => {
    // A date with the high bit set reads as the unsigned 32-bit value, so a
    // 51Did issued after February 2098 does not come back negative.
    const fod = FodId.fromBase64(
      envelopeBase64(canonicalPayload(), { date: 0xF0000001 }));
    expect(fod.date).toBe(0xF0000001);
  });
});

// The hardened read: a 51Did is answered with a reason rather than thrown,
// the OWID library's reason is carried through unchanged, the payload is
// held to the lower bound for its type and to no upper bound, and no read
// fetches a key or checks a signature.
describe('FodId.tryParse and tryFromByteArray', () => {
  const LONG_DOMAIN = 'a-self-hosted-container.example.internal.51degrees.com';

  // The offset of the four byte payload length field in an envelope built
  // by the shared builders (version, domain, terminator, four date bytes).
  function lengthFieldOffset (domain = DOMAIN) {
    return 1 + domain.length + 1 + 4;
  }

  /**
   * Asserts the three facts every successful read reports.
   * @param {object} result the read
   * @returns {FodId} the value, for further assertions
   */
  function expectParsed (result) {
    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(FodId);
    expect(result.status).toBe(ParseStatus.PARSED);
    expect(Object.isFrozen(result)).toBe(true);
    return result.value;
  }

  /**
   * Asserts the three facts every failed read reports.
   * @param {object} result the read
   * @param {string} status the expected status
   */
  function expectFailed (result, status) {
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.status).toBe(status);
    expect(Object.isFrozen(result)).toBe(true);
  }

  /**
   * Runs a read while watching every route to a key or a signature check,
   * and asserts none was taken.
   * @param {function(): object} read the read to run
   * @returns {object} what the read returned
   */
  function readWithoutCrypto (read) {
    const verify = jest.spyOn(globalThis.crypto.subtle, 'verify');
    const importKey = jest.spyOn(globalThis.crypto.subtle, 'importKey');
    const hadFetch = Object.prototype.hasOwnProperty.call(globalThis, 'fetch');
    const savedFetch = globalThis.fetch;
    const fetch = jest.fn();
    globalThis.fetch = fetch;
    try {
      const result = read();
      expect(verify).not.toHaveBeenCalled();
      expect(importKey).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      return result;
    } finally {
      verify.mockRestore();
      importKey.mockRestore();
      if (hadFetch) {
        globalThis.fetch = savedFetch;
      } else {
        delete globalThis.fetch;
      }
    }
  }

  test('the status vocabulary is the OWID one plus the three 51Did members', () => {
    expect(Object.isFrozen(ParseStatus)).toBe(true);
    for (const [name, value] of Object.entries(owid.ParseStatus)) {
      expect(ParseStatus[name]).toBe(value);
    }
    expect(ParseStatus.PAYLOAD_TOO_SHORT).toBe('PayloadTooShort');
    expect(ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH)
      .toBe('InvalidTypePayloadLength');
    expect(ParseStatus.UNSUPPORTED_PAYLOAD_VERSION)
      .toBe('UnsupportedPayloadVersion');
    expect(Object.keys(ParseStatus))
      .toHaveLength(Object.keys(owid.ParseStatus).length + 3);
    expect(SignatureStatus).toBe(owid.SignatureStatus);
  });

  test('a valid identifier with a longer self-hosted creator domain is accepted', () => {
    const bytes = envelopeBytes(canonicalPayload(), { domain: LONG_DOMAIN });
    const encoded = Buffer.from(bytes).toString('base64');
    for (const result of [
      FodId.tryParse(encoded),
      FodId.tryParse(FodId.toBase64Url(encoded)),
      FodId.tryFromByteArray(bytes)
    ]) {
      const fod = expectParsed(result);
      expect(fod.domain).toBe(LONG_DOMAIN);
      expect(fod.matchKey).toEqual(canonicalMatchKey());
      expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    }
  });

  test('a longer creator context section is accepted, so older readers stay forward compatible', () => {
    // A context section of a version this reader does not implement may be
    // any length. The reader takes the value it knows and leaves the rest.
    for (const extra of [1, 40, 400, 4000]) {
      const p = new Uint8Array(layout.PAYLOAD_LENGTH + extra);
      p.set(canonicalPayload());
      p.fill(0xCC, layout.PAYLOAD_LENGTH);
      const bytes = envelopeBytes(p);
      const fromBase64 = expectParsed(
        FodId.tryParse(Buffer.from(bytes).toString('base64')));
      const fromBytes = expectParsed(FodId.tryFromByteArray(bytes));
      for (const fod of [fromBase64, fromBytes]) {
        expect(fod.payload).toHaveLength(layout.PAYLOAD_LENGTH + extra);
        expect(fod.matchKey).toEqual(canonicalMatchKey());
        expect(fod.type).toBe(IdType.HASHED_EMAIL);
      }
    }
  });

  test('a longer Random payload is not rejected for being longer than the known shape', () => {
    const p = new Uint8Array(layout.RANDOM_PAYLOAD_LENGTH + 300);
    p.set(canonicalRandomPayload());
    p.fill(0x5A, layout.RANDOM_PAYLOAD_LENGTH);
    const fod = expectParsed(FodId.tryParse(envelopeBase64(p)));
    expect(fod.type).toBe(IdType.RANDOM);
    expect(fod.matchKey).toHaveLength(layout.GUID_LENGTH);
    expect(fod.payload).toHaveLength(p.length);
  });

  test('a too short Random payload reports InvalidTypePayloadLength', () => {
    for (let length = layout.HEADER_LENGTH; length < layout.RANDOM_PAYLOAD_LENGTH; length++) {
      const p = canonicalRandomPayload().slice(0, length);
      expectFailed(
        readWithoutCrypto(() => FodId.tryParse(envelopeBase64(p))),
        ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH);
      expectFailed(
        readWithoutCrypto(() => FodId.tryFromByteArray(envelopeBytes(p))),
        ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH);
    }
  });

  test('a too short Probabilistic or HashedEmail payload reports InvalidTypePayloadLength', () => {
    for (const flags of [0b0000_0101, 0b1000_0101]) {
      for (const length of [layout.HEADER_LENGTH, layout.RANDOM_PAYLOAD_LENGTH, layout.PAYLOAD_LENGTH - 1]) {
        const p = canonicalPayload().slice(0, length);
        p[layout.FLAGS_OFFSET] = flags;
        expectFailed(
          readWithoutCrypto(() => FodId.tryParse(envelopeBase64(p))),
          ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH);
        expectFailed(
          readWithoutCrypto(() => FodId.tryFromByteArray(envelopeBytes(p))),
          ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH);
      }
    }
  });

  test('a payload shorter than the header reports PayloadTooShort', () => {
    for (let length = 0; length < layout.HEADER_LENGTH; length++) {
      const p = canonicalPayload().slice(0, length);
      expectFailed(
        readWithoutCrypto(() => FodId.tryParse(envelopeBase64(p))),
        ParseStatus.PAYLOAD_TOO_SHORT);
      expectFailed(
        readWithoutCrypto(() => FodId.tryFromByteArray(envelopeBytes(p))),
        ParseStatus.PAYLOAD_TOO_SHORT);
    }
  });

  test('a Reserved payload keeps the best-effort read at any length from the header up', () => {
    for (const length of [layout.HEADER_LENGTH, 12, layout.PAYLOAD_LENGTH + 100]) {
      const p = new Uint8Array(length);
      p[layout.FLAGS_OFFSET] = 0b1100_0000;
      const fod = expectParsed(FodId.tryParse(envelopeBase64(p)));
      expect(fod.type).toBe(IdType.RESERVED);
      expect(fod.matchKey).toHaveLength(length - layout.HEADER_LENGTH);
    }
    expectFailed(
      FodId.tryParse(envelopeBase64(Uint8Array.from([0b1100_0000, 0, 0]))),
      ParseStatus.PAYLOAD_TOO_SHORT);
  });

  test('invalid base64 reports the OWID InvalidBase64 status', () => {
    for (const text of ['This is not valid Base64!@#$', '****', 'ab$d']) {
      const result = readWithoutCrypto(() => FodId.tryParse(text));
      expectFailed(result, owid.ParseStatus.INVALID_BASE64);
      expect(result.status).toBe(ParseStatus.INVALID_BASE64);
    }
  });

  test('an OWID declaration mismatch is propagated unchanged without any cryptography', () => {
    const bytes = envelopeBytes(payloadEndingAtMatchKey());
    const at = lengthFieldOffset();
    expect(bytes[at]).toBe(layout.PAYLOAD_LENGTH); // the field under test
    bytes[at] = layout.PAYLOAD_LENGTH + 1; // declares one byte more than sent
    const encoded = Buffer.from(bytes).toString('base64');
    const owidResult = owid.parseBytes(bytes);
    expect(owidResult.status).toBe(owid.ParseStatus.BYTE_COUNT_MISMATCH);

    expectFailed(
      readWithoutCrypto(() => FodId.tryFromByteArray(bytes)),
      owidResult.status);
    expectFailed(
      readWithoutCrypto(() => FodId.tryParse(encoded)),
      owidResult.status);
  });

  test('every other OWID failure is propagated unchanged without any cryptography', () => {
    const good = envelopeBytes(canonicalPayload());
    const unsupported = Uint8Array.from(good);
    unsupported[0] = 9;
    const cases = [
      [unsupported, owid.ParseStatus.UNSUPPORTED_VERSION],
      [good.slice(0, good.length - 1), owid.ParseStatus.BYTE_COUNT_MISMATCH],
      [good.slice(0, 4), owid.ParseStatus.UNEXPECTED_END],
      [Uint8Array.from([0]), owid.ParseStatus.ABSENT_NODE]
    ];
    for (const [bytes, status] of cases) {
      expect(owid.parseBytes(bytes).status).toBe(status);
      expectFailed(
        readWithoutCrypto(() => FodId.tryFromByteArray(bytes)), status);
      expectFailed(
        readWithoutCrypto(() =>
          FodId.tryParse(Buffer.from(bytes).toString('base64'))),
        status);
    }
  });

  test('a structurally valid but cryptographically invalid 51Did parses, then verifies as SignatureInvalid', async () => {
    const { base64 } = await signedVerifiable(canonicalPayload());
    const otherPublicPem = await randomPublicPem();
    const fod = expectParsed(readWithoutCrypto(() => FodId.tryParse(base64)));
    const check = await fod.checkSignature(otherPublicPem);
    expect(check.ok).toBe(false);
    expect(check.status).toBe(SignatureStatus.SIGNATURE_INVALID);
    await expect(fod.verify(otherPublicPem)).resolves.toBe(false);

    // A dummy signature that is not even a real ECDSA signature reads the
    // same way. Reading is one question and verifying is another.
    const dummy = expectParsed(
      FodId.tryParse(envelopeBase64(canonicalPayload())));
    const dummyCheck = await dummy.checkSignature(otherPublicPem);
    expect(dummyCheck.status).toBe(SignatureStatus.SIGNATURE_INVALID);
  });

  test('a key that cannot be used is not SignatureInvalid', async () => {
    const { base64 } = await signedVerifiable(canonicalPayload());
    const fod = expectParsed(FodId.tryParse(base64));
    for (const pem of ['', 'not a pem', '-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----\n', 42]) {
      const check = await fod.checkSignature(pem);
      expect(check.ok).toBe(false);
      expect(check.status).toBe(SignatureStatus.INVALID_KEY);
      expect(check.status).not.toBe(SignatureStatus.SIGNATURE_INVALID);
      // The boolean surface refuses to answer rather than saying false.
      await expect(fod.verify(pem)).rejects.toBeDefined();
    }
  });

  test('absent, empty and wrongly typed input', () => {
    for (const absent of [null, undefined, '', '   ', '\n']) {
      expectFailed(
        readWithoutCrypto(() => FodId.tryParse(absent)),
        ParseStatus.MISSING_INPUT);
    }
    for (const wrong of [42, {}, [], true, new Uint8Array(3)]) {
      expectFailed(
        readWithoutCrypto(() => FodId.tryParse(wrong)),
        ParseStatus.INVALID_INPUT_TYPE);
    }
    for (const absent of [null, undefined, new Uint8Array(0)]) {
      expectFailed(
        readWithoutCrypto(() => FodId.tryFromByteArray(absent)),
        ParseStatus.MISSING_INPUT);
    }
    for (const wrong of ['QUJD', 42, {}, [1, 2, 3]]) {
      expectFailed(
        readWithoutCrypto(() => FodId.tryFromByteArray(wrong)),
        ParseStatus.INVALID_INPUT_TYPE);
    }
  });

  test('tryFromByteArray copies the bytes', () => {
    const bytes = envelopeBytes(canonicalPayload());
    const fod = expectParsed(FodId.tryFromByteArray(bytes));
    bytes.fill(0);
    expect(fod.matchKey).toEqual(canonicalMatchKey());
    expect(fod.domain).toBe(DOMAIN);
  });

  test('the throwing surface throws the documented types for the same inputs', () => {
    // Argument type problems stay TypeError.
    expect(() => FodId.fromBase64(null)).toThrow(TypeError);
    expect(() => FodId.fromBase64(42)).toThrow(TypeError);
    expect(() => FodId.fromByteArray(null)).toThrow(TypeError);
    expect(() => FodId.fromByteArray('QUJD')).toThrow(TypeError);

    // The two 51Did payload statuses stay RangeError, now carrying the
    // status as well.
    const tooShort = envelopeBase64(new Uint8Array(3));
    expect(() => FodId.fromBase64(tooShort)).toThrow(RangeError);
    expect(() => FodId.fromBase64(tooShort)).toThrow(expect.objectContaining({
      status: ParseStatus.PAYLOAD_TOO_SHORT
    }));
    const shortRandom = envelopeBase64(
      canonicalRandomPayload().slice(0, layout.RANDOM_PAYLOAD_LENGTH - 1));
    expect(() => FodId.fromBase64(shortRandom)).toThrow(RangeError);
    expect(() => FodId.fromBase64(shortRandom)).toThrow(
      expect.objectContaining({
        status: ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH
      }));
    expect(() => FodId.fromByteArray(envelopeBytes(new Uint8Array(0))))
      .toThrow(RangeError);

    // An OWID status is a FodIdParseError carrying that status.
    expect(() => FodId.fromBase64('****')).toThrow(FodIdParseError);
    expect(() => FodId.fromBase64('****')).toThrow(expect.objectContaining({
      name: 'FodIdParseError', status: ParseStatus.INVALID_BASE64
    }));
    expect(() => FodId.fromBase64('')).toThrow(expect.objectContaining({
      status: ParseStatus.MISSING_INPUT
    }));
    const truncated = envelopeBytes(canonicalPayload()).slice(0, 4);
    expect(() => FodId.fromByteArray(truncated)).toThrow(FodIdParseError);
    expect(() => FodId.fromByteArray(truncated)).toThrow(
      expect.objectContaining({ status: ParseStatus.UNEXPECTED_END }));
    expect(new FodIdParseError('x')).toBeInstanceOf(Error);
    expect(new FodIdParseError('x').status).toBe('x');
  });

  test('the throwing and non-throwing surfaces agree on every input', () => {
    const inputs = [
      envelopeBase64(canonicalPayload()),
      envelopeBase64(canonicalRandomPayload()),
      envelopeBase64(new Uint8Array(2)),
      envelopeBase64(canonicalPayload().slice(0, 30)),
      '****',
      ''
    ];
    for (const input of inputs) {
      const result = FodId.tryParse(input);
      if (result.ok) {
        expect(FodId.fromBase64(input).asBase64())
          .toBe(result.value.asBase64());
      } else {
        expect(() => FodId.fromBase64(input)).toThrow(
          expect.objectContaining({ status: result.status }));
      }
    }
  });
});
