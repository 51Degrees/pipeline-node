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
 * 51Did creator context demo server.
 *
 * Serves page.html with a fresh challenge per load, and redeems the
 * encrypted result server side, adding the licence key the browser
 * never sees. The page runs the 51Did flow the way production does.
 *
 * 1. Create. The browser calls the json endpoint, which issues a 51Did
 *    for the browser's connection.
 * 2. Verify. The browser calls verify-full, the first verification
 *    step, so the cloud observes the browser's live connection. Both
 *    the signature outcome and the creator context verdict return only
 *    as an encrypted result that the browser cannot read or forge. (A
 *    deployment holding no context secret answers in the open instead.)
 *    The page then hands the encrypted result to this server.
 * 3. Redeem. This server calls redeem with the 51Did, the encrypted
 *    result and the account's licence key as the second step, and
 *    receives the signature outcome, the true creator context verdict,
 *    when the verification happened (verifiedAt) and how long ago that
 *    was (secondsSinceVerified).
 *
 * A fresh challenge is issued per page load and bound through both steps
 * by the cloud. A production server would also remember the value it
 * issued and reject a redemption carrying any other, which this demo
 * keeps out of scope.
 *
 * What a run costs: every call to the cloud is one use against the
 * subscription behind the resource key. A browser check of a 51Did makes
 * two, verify-full from the page and redeem from this server, so a
 * browser-based context check is two uses every time, on top of the
 * one use that created the identifiers.
 *
 * Environment variables:
 *   _51DEGREES_RESOURCE_KEY, or RESOURCE_KEY. Required.
 *   _51DEGREES_LICENSE_KEY, or LICENSE_KEY. Optional, see below.
 *   FOD_CLOUD_API_URL. Optional. The cloud API base including the
 *     /api/v4/ segment, defaulting to https://cloud.51degrees.com/api/v4/.
 *     This is the same variable the cloud request engine honours.
 *   PORT. Optional, defaults to 5100.
 *
 * Node 18 or later (built-in fetch), no dependencies. Run:
 *   node server.js    then open http://localhost:5100/
 */

const { createServer } = require('http');
const { readFileSync } = require('fs');
const { randomBytes } = require('crypto');
const { join } = require('path');

// The cloud API base, normalised to end in exactly one slash so every
// URL is base plus a relative path, exactly as the cloud request engine
// treats the same variable. The page builds its own two cloud calls
// from the same base once it is substituted in. A host other than
// cloud.51degrees.com would be used to (a) use an on premise web server,
// or (b) use a privately hosted version of the 51Degrees cloud for
// performance reasons. This is the private hosting option of the
// 51Degrees cloud service. Both run the same service, so the demo works
// unchanged.
const base = (process.env.FOD_CLOUD_API_URL ||
  'https://cloud.51degrees.com/api/v4/').replace(/\/*$/, '/');
const resource = process.env._51DEGREES_RESOURCE_KEY ||
  process.env.RESOURCE_KEY;
const licence = process.env._51DEGREES_LICENSE_KEY ||
  process.env.LICENSE_KEY || '';
const port = Number(process.env.PORT || 5100);
if (!resource) {
  console.error('Set _51DEGREES_RESOURCE_KEY (or RESOURCE_KEY) to the ' +
    'resource key of the page.');
  process.exit(1);
}
if (!licence) {
  // Only an account that holds licence keys needs one to redeem,
  // because the licence key is what keeps redemption to the acting
  // party's own servers. An account holding none has nothing to check
  // against, so the demo runs without it. Saying so here means an
  // account that DOES hold licence keys, run without one, is diagnosed
  // at start-up rather than by an unreadable verdict three steps later
  // that looks like a cryptographic failure.
  console.log('No _51DEGREES_LICENSE_KEY set. Redemption will work where ' +
    'the account holds no licence keys, and will report the context ' +
    'unreadable where it holds some.');
}

// Both are read PER REQUEST, not once at start-up. A demo left running
// while its page is edited would otherwise keep serving the version it
// started with, which looks exactly like an edit that did not work. The
// cost is one small file read per request, which is nothing at demo
// scale. The stylesheet is the design system build, vendored beside this
// server exactly as the other 51Degrees web examples vendor it.
const readPage = () => readFileSync(join(__dirname, 'page.html'), 'utf8');
const readCss = () => readFileSync(join(__dirname, 'examples-main.min.css'));

/**
 * Relays the browser's redemption to the cloud, adding the licence key.
 *
 * @param {URL} url the request URL carrying 51did, result and challenge
 * @param {import('http').ServerResponse} response the response to write
 * @returns {Promise<void>} resolves once the response has been sent
 */
async function redeem (url, response) {
  // The server-side step: the licence key is added here and only
  // here, so the browser never sees it.
  const upstream = new URL(base + 'id/redeem/' + resource);
  upstream.searchParams.set('51did', url.searchParams.get('51did') || '');
  upstream.searchParams.set('result', url.searchParams.get('result') || '');
  upstream.searchParams.set(
    'challenge', url.searchParams.get('challenge') || '');
  upstream.searchParams.set('license', licence);
  try {
    const redeemed = await fetch(upstream, {
      headers: { 'User-Agent': '51did-demo-node' }
    });
    // Relayed exactly as received, status code, content type and body,
    // so the page sees what the cloud said. A cloud that does not carry
    // the method answers 404 with a text body, and the page turns that
    // into a readable failure, which a 200 wrapped around it would hide.
    response.writeHead(redeemed.status, {
      'Content-Type': redeemed.headers.get('content-type') || 'text/plain'
    });
    response.end(await redeemed.text());
  } catch (error) {
    // An unreachable cloud must answer the page, not crash the demo
    // server with an unhandled rejection. The cause is the useful part,
    // since fetch itself only says that it failed.
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      error: error.cause ? error.cause.message : error.message
    }));
  }
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(readPage()
      .replaceAll('__RESOURCE__', resource)
      .replaceAll('__CHALLENGE__', randomBytes(16).toString('hex'))
      .replaceAll('__API__', base));
    return;
  }
  if (url.pathname === '/examples-main.min.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' });
    response.end(readCss());
    return;
  }
  if (url.pathname === '/redeem') {
    await redeem(url, response);
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(port, () =>
  console.log(`51Did demo on http://localhost:${port}/`));
