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

const Owid = require('owid');
const { FodId, IdType } = require('../index');

const VERSION = 2;
const DOMAIN = '51degrees.com';
const DATE = 2900000; // minutes since 2020-01-01
const CANONICAL_FLAGS = 0xA5; // HashedEmail type tag + usage bits
const CANONICAL_LICENSE_ID = 0x12345678;

function canonicalHash () {
  const h = new Uint8Array(FodId.HASH_LENGTH);
  for (let i = 0; i < h.length; i++) { h[i] = 0x20 + i; }
  return h;
}

function writeLicenseId (payload) {
  // Little-endian 0x12345678 -> 78 56 34 12.
  payload[FodId.LICENSE_ID_OFFSET] = 0x78;
  payload[FodId.LICENSE_ID_OFFSET + 1] = 0x56;
  payload[FodId.LICENSE_ID_OFFSET + 2] = 0x34;
  payload[FodId.LICENSE_ID_OFFSET + 3] = 0x12;
}

function canonicalPayload () {
  const p = new Uint8Array(FodId.PAYLOAD_LENGTH);
  p[FodId.FLAGS_OFFSET] = CANONICAL_FLAGS;
  writeLicenseId(p);
  p.set(canonicalHash(), FodId.HASH_OFFSET);
  return p;
}

function canonicalRandomPayload () {
  const p = new Uint8Array(FodId.RANDOM_PAYLOAD_LENGTH);
  p[FodId.FLAGS_OFFSET] = (1 << 6) | 0b001; // Random tag + usage bits
  writeLicenseId(p);
  for (let i = 0; i < FodId.GUID_LENGTH; i++) {
    p[FodId.HASH_OFFSET + i] = 0x40 + i;
  }
  return p;
}

function uint32LE (v) {
  return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
}

// Builds OWID envelope bytes (version 2 wire format) with the given payload and
// an arbitrary signature, matching owid-js getByteArray + a 64-byte signature.
function noSigBytes (payload, date) {
  const out = [VERSION];
  for (let i = 0; i < DOMAIN.length; i++) { out.push(DOMAIN.charCodeAt(i)); }
  out.push(0);
  out.push(...uint32LE(date));
  out.push(...uint32LE(payload.length));
  for (const b of payload) { out.push(b); }
  return Uint8Array.from(out);
}

const DUMMY_SIG = (() => {
  const s = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { s[i] = i + 1; }
  return s;
})();

function envelopeBytes (payload, { date = DATE, signature = DUMMY_SIG } = {}) {
  const noSig = noSigBytes(payload, date);
  const full = new Uint8Array(noSig.length + signature.length);
  full.set(noSig);
  full.set(signature, noSig.length);
  return full;
}

function envelopeBase64 (payload, opts) {
  return Buffer.from(envelopeBytes(payload, opts)).toString('base64');
}

// Real ECDSA P-256 signing via Web Crypto, for the verify tests.
async function signedVerifiable (payload, date = DATE) {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const noSig = noSigBytes(payload, date);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, noSig));
  const full = new Uint8Array(noSig.length + sig.length);
  full.set(noSig);
  full.set(sig, noSig.length);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    base64: Buffer.from(full).toString('base64'),
    publicPem: toPem('PUBLIC KEY', new Uint8Array(spki))
  };
}

async function randomPublicPem () {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return toPem('PUBLIC KEY', new Uint8Array(spki));
}

function toPem (label, der) {
  const b64 = Buffer.from(der).toString('base64');
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n` +
    `-----END ${label}-----\n`;
}

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
    const o = new Owid(envelopeBase64(canonicalPayload()));
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

    expect(fa.hash).toEqual(fb.hash); // value is stable
    expect(fa.date).not.toBe(fb.date); // envelope differs
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
    const o = new Owid(envelopeBase64(canonicalPayload()));
    const fod = FodId.fromOwid(o);
    o.owid.payload = new Uint8Array(FodId.PAYLOAD_LENGTH); // mutate the source
    expect(fod.hash).toEqual(canonicalHash());
    expect(fod.flags).toBe(CANONICAL_FLAGS);
    expect(fod.payload[FodId.HASH_OFFSET]).toBe(0x20);
  });

  test('constructor is decoupled from the source owid', () => {
    // The constructor must copy the owid too, not just fromOwid - mutating the
    // source afterwards must not affect the FodId.
    const o = new Owid(envelopeBase64(canonicalPayload()));
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
});
