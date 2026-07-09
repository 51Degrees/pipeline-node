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

/**
 * Offline example for the 51Did (FodId) reader.
 *
 * The 51Degrees Cloud service issues real 51Dids. To keep this example
 * self-contained and offline, it builds a sample 51Did in process - generate
 * an ECDSA P-256 key pair, sign a canonical 37-byte payload - then parses it
 * back and prints the three payload fields. It also shows the headline use
 * case: a 51Did is re-issued fresh on every call (the envelope, hence the
 * base64, changes), but the value (the Hash) is stable. Compare values, never
 * envelopes.
 */

const { webcrypto } = require('crypto');
const { FodId, IdType } = require('../index');

const subtle = webcrypto.subtle;
const VERSION = 2;
const DOMAIN = '51degrees.com';
const DATE = 2900000; // minutes since 2020-01-01

function uint32LE (v) {
  return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
}

function samplePayload () {
  const p = new Uint8Array(FodId.PAYLOAD_LENGTH); // Probabilistic (flags 0x00)
  p[FodId.LICENSE_ID_OFFSET] = 0x78;
  p[FodId.LICENSE_ID_OFFSET + 1] = 0x56;
  p[FodId.LICENSE_ID_OFFSET + 2] = 0x34;
  p[FodId.LICENSE_ID_OFFSET + 3] = 0x12;
  for (let i = 0; i < FodId.HASH_LENGTH; i++) { p[FodId.HASH_OFFSET + i] = 0x20 + i; }
  return p;
}

function noSigBytes (payload, date) {
  const out = [VERSION];
  for (let i = 0; i < DOMAIN.length; i++) { out.push(DOMAIN.charCodeAt(i)); }
  out.push(0);
  out.push(...uint32LE(date));
  out.push(...uint32LE(payload.length));
  for (const b of payload) { out.push(b); }
  return Uint8Array.from(out);
}

async function issue (privateKey, payload, date) {
  const noSig = noSigBytes(payload, date);
  const sig = new Uint8Array(await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, privateKey, noSig));
  const full = new Uint8Array(noSig.length + sig.length);
  full.set(noSig);
  full.set(sig, noSig.length);
  return Buffer.from(full).toString('base64');
}

function toPem (label, der) {
  const b64 = Buffer.from(der).toString('base64');
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n` +
    `-----END ${label}-----\n`;
}

async function run () {
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicPem = toPem('PUBLIC KEY',
    new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey)));
  const payload = samplePayload();

  const fodId = FodId.fromBase64(await issue(keyPair.privateKey, payload, DATE));

  console.log('51Did parsed from base64:');
  console.log('  Domain    :', fodId.domain);
  console.log('  Type      :', IdType.name(fodId.type));
  console.log('  Flags     : 0x' + fodId.flags.toString(16));
  console.log('  LicenseId :', fodId.licenseId);
  console.log('  Hash      :', Buffer.from(fodId.hash).toString('hex'));
  console.log('  Verifies  :', await fodId.verify(publicPem));

  // Re-issue the same payload at a later time: a separate envelope, same value.
  const reissued = FodId.fromBase64(
    await issue(keyPair.privateKey, payload, DATE + 5));
  const sameEnvelope = fodId.asBase64() === reissued.asBase64();
  const sameValue = Buffer.from(fodId.hash).equals(Buffer.from(reissued.hash));

  console.log('\nSame payload, re-issued:');
  console.log('  Same envelope (base64) :', sameEnvelope);
  console.log('  Same value (Hash)      :', sameValue);

  if (sameEnvelope || !sameValue) {
    throw new Error(
      'Expected a different envelope but the same value across reissues.');
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
