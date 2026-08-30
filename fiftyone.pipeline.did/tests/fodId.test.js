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
const { FodId, IdType } = require('../index');
const {
  DOMAIN,
  DATE,
  CANONICAL_FLAGS,
  CANONICAL_LICENSE_ID,
  DUMMY_SIG,
  canonicalHash,
  canonicalPayload,
  canonicalRandomPayload,
  envelopeBytes,
  envelopeBase64,
  signedVerifiable,
  randomPublicPem
} = require('./envelope');

describe('FodId', () => {
  // ----- Current .NET coverage -----

  test('constants are internally consistent', () => {
    expect(FodId.HASH_OFFSET + FodId.HASH_LENGTH).toBe(FodId.PAYLOAD_LENGTH);
    expect(FodId.LICENSE_ID_OFFSET + FodId.LICENSE_ID_LENGTH)
      .toBe(FodId.HASH_OFFSET);
    expect(FodId.HASH_OFFSET + FodId.GUID_LENGTH)
      .toBe(FodId.RANDOM_PAYLOAD_LENGTH);
  });

  test('exposes OWID-level fields', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    // OWID-level concerns are delegated to the wrapped envelope.
    expect(fod.domain).toBe(DOMAIN);
    expect(fod.version).toBeDefined();
  });

  test('fromBase64 unpacks all three fields', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.domain).toBe(DOMAIN);
  });

  test('fromByteArray unpacks all three fields', () => {
    const fod = FodId.fromByteArray(envelopeBytes(canonicalPayload()));
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.domain).toBe(DOMAIN);
  });

  test('fromOwid unpacks all three fields', () => {
    const o = new owid(envelopeBase64(canonicalPayload()));
    const fod = FodId.fromOwid(o);
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.domain).toBe(o.domain);
    expect(fod.date).toBe(o.date);
    expect(fod.version).toBe(o.owid.version);
    expect(fod.payload).toEqual(o.owid.payload);
    expect(fod.signature).toEqual(o.signature);
  });

  test('null owid throws', () => {
    expect(() => FodId.fromOwid(null)).toThrow(TypeError);
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

  test('flags zero value exposed', () => {
    const p = canonicalPayload();
    p[FodId.FLAGS_OFFSET] = 0x00;
    expect(FodId.fromBase64(envelopeBase64(p)).flags).toBe(0);
  });

  test('flags all bits set exposed', () => {
    const p = canonicalPayload();
    p[FodId.FLAGS_OFFSET] = 0xFF;
    expect(FodId.fromBase64(envelopeBase64(p)).flags).toBe(255);
  });

  test('hash is a defensive copy', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    const h = fod.hash;
    h[0] = 0x00;
    h[FodId.HASH_LENGTH - 1] = 0x00;
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.payload[FodId.HASH_OFFSET]).toBe(0x20);
  });

  test('payload one byte short throws', () => {
    expect(() => FodId.fromBase64(envelopeBase64(new Uint8Array(FodId.PAYLOAD_LENGTH - 1))))
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
    expect(() => FodId.fromBase64('This is not valid Base64!@#$')).toThrow();
  });

  test('payload larger than spec uses first 37 bytes', () => {
    const p = new Uint8Array(64);
    p.set(canonicalPayload());
    p.fill(0xCC, FodId.PAYLOAD_LENGTH);
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.hash.length).toBe(FodId.HASH_LENGTH);
  });

  test('a long context section and a long creator domain both parse', () => {
    // The creator domain is a deployment parameter, so a self-hosted
    // container may sign with a longer one, and a context section of a
    // version this reader does not implement may be longer still. Both
    // must parse and leave the judgement to the cloud.
    const p = new Uint8Array(FodId.PAYLOAD_LENGTH + 400);
    p.set(canonicalPayload());
    p.fill(0xCC, FodId.PAYLOAD_LENGTH);
    const bytes = envelopeBytes(p, {
      domain: 'a-self-hosted-container.example.internal.51degrees.com'
    });
    const encoded = Buffer.from(bytes).toString('base64');

    for (const fod of [
      FodId.fromBase64(encoded),
      FodId.fromByteArray(bytes),
      FodId.fromOwid(new owid(encoded))
    ]) {
      expect(fod.flags).toBe(CANONICAL_FLAGS);
      expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
      expect(fod.hash).toEqual(canonicalHash());
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
      expect(fod.hash).toEqual(expected.hash);
      expect(fod.licenseId).toBe(expected.licenseId);
      expect(fod.flags).toBe(expected.flags);
    }
  });

  test('is cryptographically verifiable', async () => {
    const { base64, publicPem } = await signedVerifiable(canonicalPayload());
    const fod = FodId.fromBase64(base64);
    await expect(fod.verify(publicPem)).resolves.toBe(true);
  });

  test('base64 round-trip preserves all fields', () => {
    const fod1 = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    const fod2 = FodId.fromBase64(fod1.asBase64());
    expect(fod2.flags).toBe(fod1.flags);
    expect(fod2.licenseId).toBe(fod1.licenseId);
    expect(fod2.hash).toEqual(fod1.hash);
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
    p[FodId.FLAGS_OFFSET] = flags;
    return FodId.fromBase64(envelopeBase64(p)).type;
  }

  test('type is Random when bits are 01', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalRandomPayload()));
    expect(fod.type).toBe(IdType.RANDOM);
  });

  test('Random 21-byte payload parses', () => {
    const fod = FodId.fromBase64(envelopeBase64(canonicalRandomPayload()));
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash.length).toBe(FodId.GUID_LENGTH);
    const guid = new Uint8Array(FodId.GUID_LENGTH);
    for (let i = 0; i < guid.length; i++) { guid[i] = 0x40 + i; }
    expect(fod.hash).toEqual(guid);
  });

  test('Random payload one byte short throws', () => {
    const p = canonicalRandomPayload().slice(0, FodId.RANDOM_PAYLOAD_LENGTH - 1);
    expect(() => FodId.fromBase64(envelopeBase64(p))).toThrow(RangeError);
  });

  test('Random payload larger than spec uses first 16 value bytes', () => {
    const p = new Uint8Array(FodId.PAYLOAD_LENGTH);
    p.set(canonicalRandomPayload());
    p.fill(0xCC, FodId.RANDOM_PAYLOAD_LENGTH);
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.type).toBe(IdType.RANDOM);
    expect(fod.hash.length).toBe(FodId.GUID_LENGTH);
  });

  test('HashedEmail payload one byte short throws', () => {
    const p = canonicalPayload().slice(0, FodId.PAYLOAD_LENGTH - 1);
    expect(() => FodId.fromBase64(envelopeBase64(p))).toThrow(RangeError);
  });

  test('Reserved header-only payload parses', () => {
    const p = new Uint8Array(FodId.HASH_OFFSET);
    p[FodId.FLAGS_OFFSET] = 0b1100_0000;
    const fod = FodId.fromBase64(envelopeBase64(p));
    expect(fod.type).toBe(IdType.RESERVED);
    expect(fod.hash.length).toBe(0);
  });

  // ----- Gap tests (runbook section 6b) -----

  test('compare two 51Dids over the same payload', () => {
    const payload = canonicalPayload();
    const sigB = DUMMY_SIG.map((b) => b ^ 0xFF);
    const a = envelopeBase64(payload, { date: DATE, signature: DUMMY_SIG });
    const b = envelopeBase64(payload, { date: DATE + 5, signature: sigB });
    const fa = FodId.fromBase64(a);
    const fb = FodId.fromBase64(b);

    expect(fa.hash).toEqual(fb.hash);            // value is stable
    expect(fa.date).not.toBe(fb.date);           // envelope differs
    expect(fa.signature).not.toEqual(fb.signature);
    expect(a).not.toBe(b);
  });

  test('construction does not verify', () => {
    // An envelope with a bogus signature still constructs and exposes all
    // three fields - construction must not verify.
    const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.licenseId).toBe(CANONICAL_LICENSE_ID);
    expect(fod.hash).toEqual(canonicalHash());
  });

  test('fromOwid is decoupled from the source owid', () => {
    // Mutating the source owid after construction must not affect the FodId
    // (it holds an independent copy).
    const o = new owid(envelopeBase64(canonicalPayload()));
    const fod = FodId.fromOwid(o);
    o.owid.payload = new Uint8Array(FodId.PAYLOAD_LENGTH); // mutate the source
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.payload[FodId.HASH_OFFSET]).toBe(0x20);
  });

  test('constructor is decoupled from the source owid', () => {
    // The constructor must copy the owid too, not just fromOwid - mutating the
    // source afterwards must not affect the FodId.
    const o = new owid(envelopeBase64(canonicalPayload()));
    const fod = new FodId(o);
    o.owid.payload = new Uint8Array(FodId.PAYLOAD_LENGTH); // mutate the source
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.payload[FodId.HASH_OFFSET]).toBe(0x20);
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
    expect(fod2.flags).toBe(fod1.flags);
    expect(fod2.licenseId).toBe(fod1.licenseId);
    expect(fod2.hash).toEqual(fod1.hash);
    expect(fod2.domain).toBe(fod1.domain);
  });

  // ----- Both base64 alphabets -----

  // A payload whose envelope base64 contains both characters that differ
  // between the alphabets, so the URL-safe form is a real conversion.
  function alphabetPayload () {
    const p = canonicalPayload();
    // 0xFB 0xFF 0xBF encodes to "+/+/" in standard base64.
    p[FodId.HASH_OFFSET] = 0xFB;
    p[FodId.HASH_OFFSET + 1] = 0xFF;
    p[FodId.HASH_OFFSET + 2] = 0xBF;
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
      expect(fod.flags).toBe(a.flags);
      expect(fod.licenseId).toBe(a.licenseId);
      expect(fod.hash).toEqual(a.hash);
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
    expect(back.hash).toEqual(fod.hash);
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

  test('dateMinutes equals the envelope date field', () => {
    const fod = FodId.fromBase64(
      envelopeBase64(canonicalPayload(), { date: DATE }));
    expect(fod.dateMinutes).toBe(DATE);
    expect(fod.dateMinutes).toBe(fod.date);
  });

  test('dateMinutes is unsigned', () => {
    // A date with the high bit set reads as negative through the OWID
    // library and as the unsigned 32-bit value here.
    const fod = FodId.fromBase64(
      envelopeBase64(canonicalPayload(), { date: 0xF0000001 }));
    expect(fod.dateMinutes).toBe(0xF0000001);
    expect(fod.date).toBeLessThan(0);
  });
});
