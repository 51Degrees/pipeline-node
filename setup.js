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

jest.setTimeout(10000); // in milliseconds

// Ensure the Web Crypto and base64 globals that owid-based packages (e.g.
// fiftyone.pipeline.did) rely on are present in the Jest sandbox. A normal
// Node 19+ runtime exposes these already; on older runtimes they are absent,
// which surfaced as "ReferenceError: crypto is not defined" in CI. The guards
// make this a no-op where the globals already exist.
const { webcrypto } = require('crypto');

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (bin) => Buffer.from(bin, 'binary').toString('base64');
}
