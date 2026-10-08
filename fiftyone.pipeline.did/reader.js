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

const IdType = require('./idType');
const Usage = require('./usage');
const { unpack } = require('./internal/payload');
const { payloadOf } = require('./internal/envelope');

/**
 * What a 51Did says of itself, for code that has to decide where an
 * identifier may go and under which terms, and needs nothing else from
 * this package. It is the entry point for a web page, where every byte is
 * sent to every visitor, so it loads no OWID library, no key handling and
 * no client for the remote server.
 *
 * It answers with the same named values {@link FodId} does, worked out by
 * the same walk of the payload, so the two cannot disagree about an
 * identifier. It checks no signature and fetches nothing, so an identifier
 * it reads may still be a forgery, and code that has to know an identifier
 * is genuine uses {@link FodId} from the package entry point.
 *
 * @typedef {object} FodIdFacts
 * @property {boolean} ok whether the value is a structurally valid 51Did
 * @property {number|null} type one of {@link IdType}, null when not ok
 * @property {number|null} usage one of {@link Usage}, being the highest
 * usage granted, null when not ok
 * @property {boolean|null} usageIsIndirect whether the issuer worked the
 * usage out from a signal other than the caller stating it, null when not
 * ok
 * @property {string|null} terms the address of the terms document the
 * identifier was created under, null where it states none, where this
 * package does not know the document, and when not ok
 */

const NOT_A_51DID = Object.freeze({
  ok: false, type: null, usage: null, usageIsIndirect: null, terms: null
});

/**
 * Reads the type, the usage and the terms of a 51Did. The value may be
 * anything at all, because a 51Did arrives from outside and failing to be
 * one is an ordinary outcome, so this never throws.
 * @param {*} value a 51Did in either base 64 alphabet
 * @returns {FodIdFacts} a frozen answer
 */
function read (value) {
  const payload = payloadOf(value);
  const unpacked = payload && unpack(payload);
  if (!unpacked || !unpacked.ok) {
    return NOT_A_51DID;
  }
  return Object.freeze({
    ok: true,
    type: unpacked.type,
    usage: unpacked.usage,
    usageIsIndirect: unpacked.usageIsIndirect,
    terms: unpacked.terms
  });
}

module.exports = { read, IdType, Usage };
