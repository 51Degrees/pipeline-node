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

// Builders for OWID envelopes carrying a 51Did payload, shared by the
// tests. Envelopes are built byte for byte (version, domain, date, payload
// length, payload, 64 byte signature), matching owid-js getByteArray plus
// the signature, and signed with real ECDSA P-256 keys where a test needs
// a signature that verifies.

const FodId = require('../fodId');

const VERSION = 2;
const SIGNED_VERSION = 3;
const DOMAIN = '51degrees.com';
const DATE = 2900000; // minutes since 2020-01-01
const CANONICAL_FLAGS = 0xA5; // HashedEmail type tag + usage bits
const CANONICAL_LICENSE_ID = 0x12345678;
const OWID_EPOCH_MS = Date.UTC(2020, 0, 1);

function canonicalMatchKey () {
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
  p.set(canonicalMatchKey(), FodId.HASH_OFFSET);
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

// The bytes the signature covers: everything before the signature.
function noSigBytes (payload, date, version = VERSION, domain = DOMAIN) {
  const out = [version];
  for (let i = 0; i < domain.length; i++) { out.push(domain.charCodeAt(i)); }
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

function envelopeBytes (payload, {
  date = DATE, signature = DUMMY_SIG, version = VERSION, domain = DOMAIN
} = {}) {
  const noSig = noSigBytes(payload, date, version, domain);
  const full = new Uint8Array(noSig.length + signature.length);
  full.set(noSig);
  full.set(signature, noSig.length);
  return full;
}

function envelopeBase64 (payload, opts) {
  return Buffer.from(envelopeBytes(payload, opts)).toString('base64');
}

function toPem (label, der) {
  const b64 = Buffer.from(der).toString('base64');
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n` +
    `-----END ${label}-----\n`;
}

async function generateKeyPair () {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

async function publicPemOf (keyPair) {
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return toPem('PUBLIC KEY', new Uint8Array(spki));
}

// An envelope signed with the given key pair, as base64.
async function signedWith (keyPair, payload, {
  date = DATE, version = SIGNED_VERSION, domain = DOMAIN
} = {}) {
  const noSig = noSigBytes(payload, date, version, domain);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, noSig));
  const full = new Uint8Array(noSig.length + sig.length);
  full.set(noSig);
  full.set(sig, noSig.length);
  return Buffer.from(full).toString('base64');
}

// Real ECDSA P-256 signing via Web Crypto, with a fresh key pair, for the
// verify tests.
async function signedVerifiable (payload, date = DATE, version = VERSION) {
  const keyPair = await generateKeyPair();
  return {
    base64: await signedWith(keyPair, payload, { date, version }),
    publicPem: await publicPemOf(keyPair)
  };
}

async function randomPublicPem () {
  return publicPemOf(await generateKeyPair());
}

// The OWID date field for a moment, in whole minutes since 2020-01-01.
function minutesOf (date) {
  return Math.floor((date.getTime() - OWID_EPOCH_MS) / 60000);
}

module.exports = {
  VERSION,
  SIGNED_VERSION,
  DOMAIN,
  DATE,
  CANONICAL_FLAGS,
  CANONICAL_LICENSE_ID,
  DUMMY_SIG,
  canonicalMatchKey,
  canonicalPayload,
  canonicalRandomPayload,
  noSigBytes,
  envelopeBytes,
  envelopeBase64,
  toPem,
  generateKeyPair,
  publicPemOf,
  signedWith,
  signedVerifiable,
  randomPublicPem,
  minutesOf
};
