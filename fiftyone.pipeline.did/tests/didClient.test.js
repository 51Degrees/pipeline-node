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

const {
  FodId,
  DidClient,
  RedeemResult,
  ContextResult,
  SignatureResult,
  SignatureReason,
  DidClientError,
  DidArgumentError,
  DidNotSupportedError
} = require('../index');
const {
  canonicalPayload,
  canonicalRandomPayload,
  envelopeBase64,
  generateKeyPair,
  publicPemOf,
  signedWith,
  minutesOf
} = require('./envelope');

const RESOURCE = 'AQTestResourceKey';
const LICENCE = 'TEST-LICENCE-KEY';
const ENDPOINT = 'https://cloud.example/api/v4/';
const USER_AGENT = 'fiftyone.pipeline.did/' +
  require('../package.json').version;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Far longer than any identifier the cloud issues, so the client's guard
// against obviously malformed input turns it away before it does any work.
const OVER_LONG = 'A'.repeat(8192);

// Three weekly periods, Monday to Monday, as the cloud's generator writes.
const START_1 = new Date('2026-08-03T00:00:00Z');
const START_2 = new Date('2026-08-10T00:00:00Z');
const START_3 = new Date('2026-08-17T00:00:00Z');

/**
 * A fetch stand-in recording every call and answering from a handler.
 * @param {function(string, object, number): object} handler given the URL,
 * the init and the call number, returns a response
 * @returns {function} the fetch function, with a `calls` array
 */
function fakeFetch (handler) {
  const calls = [];
  const fetch = async (url, init) => {
    const call = { url: String(url), init: init || {} };
    calls.push(call);
    return handler(call.url, call.init, calls.length);
  };
  fetch.calls = calls;
  return fetch;
}

function response (status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, text: async () => text };
}

/**
 * A schedule of three real key pairs and the JSON the key endpoint
 * would answer with.
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
    { startsAt: START_1.toISOString(), weekStart: 'x', publicKey: pems[0] },
    { startsAt: START_2.toISOString(), weekStart: 'x', publicKey: pems[1] },
    { startsAt: START_3.toISOString(), weekStart: 'x', publicKey: pems[2] }
  ];
  return { pairs, pems, json };
}

function keyClient (json, extra = {}) {
  const fetch = fakeFetch((url) => {
    if (url.indexOf('id/key/') >= 0) {
      return response(200, typeof json === 'function' ? json() : json);
    }
    throw new Error('unexpected request ' + url);
  });
  const client = new DidClient(Object.assign({
    resourceKey: RESOURCE, endpoint: ENDPOINT, fetch
  }, extra));
  return { client, fetch };
}

async function signedAt (pair, at, options = {}) {
  return FodId.fromBase64(await signedWith(
    pair, options.payload || canonicalPayload(),
    {
      date: minutesOf(at),
      version: options.version,
      domain: options.domain
    }));
}

describe('DidClient construction', () => {
  const saved = process.env.FOD_CLOUD_API_URL;
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.FOD_CLOUD_API_URL;
    } else {
      process.env.FOD_CLOUD_API_URL = saved;
    }
  });

  test('resourceKey is required', () => {
    expect(() => new DidClient({})).toThrow(TypeError);
    expect(() => new DidClient({ resourceKey: '' })).toThrow(TypeError);
    expect(() => new DidClient(null)).toThrow(TypeError);
  });

  test('endpoint defaults to the public cloud', () => {
    delete process.env.FOD_CLOUD_API_URL;
    const client = new DidClient({ resourceKey: RESOURCE, fetch: fakeFetch(() => null) });
    expect(client.endpoint).toBe('https://cloud.51degrees.com/api/v4/');
    expect(client.resourceKey).toBe(RESOURCE);
  });

  test('endpoint reads FOD_CLOUD_API_URL and normalises the slash', () => {
    process.env.FOD_CLOUD_API_URL = 'https://other.example/api/v4';
    const client = new DidClient({ resourceKey: RESOURCE, fetch: fakeFetch(() => null) });
    expect(client.endpoint).toBe('https://other.example/api/v4/');
  });

  test('endpoint option wins over the environment', () => {
    process.env.FOD_CLOUD_API_URL = 'https://other.example/api/v4';
    const client = new DidClient({
      resourceKey: RESOURCE, endpoint: 'https://mine.example/api/v4//', fetch: fakeFetch(() => null)
    });
    expect(client.endpoint).toBe('https://mine.example/api/v4/');
  });

  test('a missing fetch is refused', () => {
    expect(() => new DidClient({ resourceKey: RESOURCE, fetch: 'no' }))
      .toThrow(TypeError);
  });
});

describe('DidClient public keys', () => {
  test('reads startsAt and publicKey, oldest first, ignoring weekStart', async () => {
    const { pems, json } = await schedule();
    const { client, fetch } = keyClient([json[2], json[0], json[1]]);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
    expect(keys.map((k) => k.publicKey)).toEqual(pems);
    expect(keys[0].weekStart).toBeUndefined();
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0].url).toBe(ENDPOINT + 'id/key/' + RESOURCE);
    expect(fetch.calls[0].init.method).toBe('GET');
    expect(fetch.calls[0].init.headers['User-Agent']).toBe(USER_AGENT);
  });

  test('reads created where startsAt is absent', async () => {
    const { pems, json } = await schedule();
    const older = json.map((entry) => ({
      created: entry.startsAt, publicKey: entry.publicKey
    }));
    const { client } = keyClient(older);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
    expect(keys[1].publicKey).toBe(pems[1]);
  });

  test('second call is a cache hit', async () => {
    const { json } = await schedule();
    const { client, fetch } = keyClient(json);
    const first = await client.publicKeys();
    const second = await client.publicKeys();
    expect(second).toBe(first);
    expect(fetch.calls).toHaveLength(1);
  });

  test('concurrent first calls share one request', async () => {
    const { json } = await schedule();
    const { client, fetch } = keyClient(json);
    const [a, b] = await Promise.all([client.publicKeys(), client.publicKeys()]);
    expect(a).toBe(b);
    expect(fetch.calls).toHaveLength(1);
  });

  test('a non-200 answer is a DidClientError with the status', async () => {
    const fetch = fakeFetch(() => response(401, { errors: ['bad key'] }));
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await expect(client.publicKeys()).rejects.toMatchObject({
      name: 'DidClientError', statusCode: 401
    });
  });

  test('a body that is not an array is refused', async () => {
    const fetch = fakeFetch(() => response(200, { publicKey: 'x' }));
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await expect(client.publicKeys()).rejects.toBeInstanceOf(DidClientError);
  });

  test('an entry without a start or key is refused', async () => {
    const fetch = fakeFetch(() => response(200, [{ publicKey: 'x' }]));
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await expect(client.publicKeys()).rejects.toBeInstanceOf(DidClientError);
  });
});

describe('DidClient publicKeyFor', () => {
  test('answers the key in force at the identifier date', async () => {
    const { pairs, pems, json } = await schedule();
    const { client, fetch } = keyClient(json);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + 3 * DAY));
    const key = await client.publicKeyFor(fod);
    expect(key.publicKey).toBe(pems[1]);
    expect(key.startsAt).toEqual(START_2);
    expect(fetch.calls).toHaveLength(1);
  });

  test('accepts the base64 string too', async () => {
    const { pairs, pems, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_1.getTime() + DAY));
    const key = await client.publicKeyFor(fod.asBase64Url());
    expect(key.publicKey).toBe(pems[0]);
  });

  test('refuses an over-long encoded value before a key fetch', async () => {
    const { client, fetch } = keyClient([]);
    await expect(client.publicKeyFor(OVER_LONG))
      .rejects.toBeInstanceOf(DidArgumentError);
    expect(fetch.calls).toHaveLength(0);
  });

  test('no refetch when the cache covers the date', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    await client.publicKeyFor(await signedAt(pairs[0], new Date(START_1.getTime() + DAY)));
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    await client.publicKeyFor(await signedAt(pairs[2], START_3));
    expect(fetch.calls).toHaveLength(1);
  });

  test('refetches once when the date is later than the newest start', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    expect(fetch.calls).toHaveLength(1);
    const later = await signedAt(pairs[2], new Date(START_3.getTime() + DAY));
    const key = await client.publicKeyFor(later);
    expect(key.startsAt).toEqual(START_3);
    expect(fetch.calls).toHaveLength(2);
    // The newest key still answers, so the next later date refetches again
    // rather than being served from a list already known to end there.
    await client.publicKeyFor(later);
    expect(fetch.calls).toHaveLength(3);
  });

  test('refetches once when no entry covers the date', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    const early = await signedAt(pairs[0], new Date(START_1.getTime() - DAY));
    expect(await client.publicKeyFor(early)).toBeNull();
    expect(fetch.calls).toHaveLength(2);
  });

  test('refetches when the list is more than a day old', async () => {
    const { pairs, json } = await schedule();
    let now = START_2.getTime() + DAY;
    const { client, fetch } = keyClient(json, { now: () => now });
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    await client.publicKeyFor(fod);
    now += 23 * HOUR;
    await client.publicKeyFor(fod);
    expect(fetch.calls).toHaveLength(1);
    now += 2 * HOUR;
    await client.publicKeyFor(fod);
    expect(fetch.calls).toHaveLength(2);
    await client.publicKeyFor(fod);
    expect(fetch.calls).toHaveLength(2);
  });

  test('a fresh list on first use is not fetched twice', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    const early = await signedAt(pairs[0], new Date(START_1.getTime() - DAY));
    expect(await client.publicKeyFor(early)).toBeNull();
    expect(fetch.calls).toHaveLength(1);
  });
});

describe('DidClient verifySignature', () => {
  test('true with the key in force', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + 2 * DAY));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: true, reason: SignatureReason.VERIFIED
    });
  });

  test('accepts the base64 string in the URL-safe alphabet', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + 2 * DAY));
    await expect(client.verifySignature(fod.asBase64Url())).resolves.toBe(true);
  });

  test('true with the earlier neighbour just after a boundary', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_2.getTime() + 5 * MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('false with the earlier key beyond the tolerance', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_2.getTime() + 16 * MINUTE));
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: false, reason: SignatureReason.SIGNATURE
    });
  });

  test('true with the later neighbour just before a boundary', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[2], new Date(START_3.getTime() - 5 * MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('false with the later key beyond the tolerance', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[2], new Date(START_3.getTime() - 16 * MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(false);
  });

  test('never tries an earlier key for a later period', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    // Signed with the first key but dated in the third period.
    const fod = await signedAt(pairs[0], new Date(START_3.getTime() + DAY));
    await expect(client.verifySignature(fod)).resolves.toBe(false);
  });

  test('no candidate before the schedule', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_1.getTime() - HOUR));
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: false, reason: SignatureReason.NO_KEY
    });
    await expect(client.verifySignature(fod)).resolves.toBe(false);
  });

  test('the later neighbour covers a date just before the schedule', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_1.getTime() - 5 * MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('false with the wrong key', async () => {
    const { json } = await schedule();
    const { client } = keyClient(json);
    const other = await generateKeyPair();
    const fod = await signedAt(other, new Date(START_2.getTime() + DAY));
    await expect(client.verifySignature(fod)).resolves.toBe(false);
  });

  test('false for version 2', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), { version: 2 });
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: false, reason: SignatureReason.VERSION
    });
    // Refused before any key is needed.
    expect(fetch.calls).toHaveLength(0);
  });

  test('false for a payload shorter than the base', async () => {
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    // A Reserved type parses at any length from the header up, so it is
    // the way to present a payload the cloud's length rule refuses.
    const short = new Uint8Array(20);
    short[FodId.FLAGS_OFFSET] = 0b11000000;
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), { payload: short });
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: false, reason: SignatureReason.LENGTH
    });
    expect(fetch.calls).toHaveLength(0);
  });

  test('a Random payload has the shorter base', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), {
      payload: canonicalRandomPayload()
    });
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('true for a payload longer than the base (a context section)', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const withContext = new Uint8Array(FodId.PAYLOAD_LENGTH + 40);
    withContext.set(canonicalPayload());
    withContext.fill(0x5A, FodId.PAYLOAD_LENGTH);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), {
      payload: withContext
    });
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('true for a long context section and a long creator domain', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const withContext = new Uint8Array(FodId.PAYLOAD_LENGTH + 200);
    withContext.set(canonicalPayload());
    withContext.fill(0x5A, FodId.PAYLOAD_LENGTH);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), {
      payload: withContext,
      domain: 'a-self-hosted-container.example.internal.51degrees.com'
    });
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('an over-long encoded value is refused before parsing or a key fetch', async () => {
    const { client, fetch } = keyClient([]);
    await expect(client.verifySignatureDetailed(OVER_LONG))
      .rejects.toBeInstanceOf(DidArgumentError);
    await expect(client.verifySignature(OVER_LONG))
      .rejects.toBeInstanceOf(DidArgumentError);
    expect(fetch.calls).toHaveLength(0);
  });

  test('a string that is not a 51Did is refused as an argument', async () => {
    const { client, fetch } = keyClient([]);
    await expect(client.verifySignature('This is not valid Base64!@#'))
      .rejects.toBeInstanceOf(DidArgumentError);
    expect(fetch.calls).toHaveLength(0);
  });

  test('a value that is neither FodId nor string is refused', async () => {
    const { json } = await schedule();
    const { client } = keyClient(json);
    await expect(client.verifySignature(42)).rejects.toThrow(TypeError);
  });
});

describe('DidClient verify (cloud)', () => {
  const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));

  function verifyClient (status, body) {
    const fetch = fakeFetch(() => response(status, body));
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    return { client, fetch };
  }

  test('200 valid answers true and sends the URL-safe form under both names', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    await expect(client.verify(fod)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0].url).toBe(
      ENDPOINT + 'id/verify/' + RESOURCE + '?51did=' + fod.asBase64Url() +
      '&owid=' + fod.asBase64Url());
    expect(fetch.calls[0].init.method).toBe('GET');
    expect(fetch.calls[0].init.headers['User-Agent']).toBe(USER_AGENT);
  });

  test('a string is sent URL-encoded as given', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    await client.verify(fod.asBase64());
    expect(fetch.calls[0].url).toBe(
      ENDPOINT + 'id/verify/' + RESOURCE + '?51did=' +
      encodeURIComponent(fod.asBase64()) + '&owid=' +
      encodeURIComponent(fod.asBase64()));
  });

  test('padded, unpadded and object forms are all accepted', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    await expect(client.verify(fod.asBase64())).resolves.toBe(true);
    await expect(client.verify(fod.asBase64Url())).resolves.toBe(true);
    await expect(client.verify(fod)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(3);
  });

  test('an over-long encoded value is refused before transport', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    await expect(client.verify(OVER_LONG))
      .rejects.toBeInstanceOf(DidArgumentError);
    expect(fetch.calls).toHaveLength(0);
  });

  test('400 invalid answers false', async () => {
    const { client } = verifyClient(400, { valid: false });
    await expect(client.verify(fod)).resolves.toBe(false);
  });

  test('400 errors raises DidArgumentError with the cloud message', async () => {
    const { client } = verifyClient(400, {
      errors: ['Value for 51did is not a valid Base64-encoded 51Did: \'x\'.']
    });
    await expect(client.verify('x')).rejects.toMatchObject({
      name: 'DidArgumentError',
      statusCode: 400,
      message: 'Value for 51did is not a valid Base64-encoded 51Did: \'x\'.'
    });
    await expect(client.verify('x')).rejects.toBeInstanceOf(DidArgumentError);
    await expect(client.verify('x')).rejects.toBeInstanceOf(DidClientError);
  });

  test('another status raises DidClientError', async () => {
    const { client } = verifyClient(500, 'boom');
    await expect(client.verify(fod)).rejects.toMatchObject({
      name: 'DidClientError', statusCode: 500, body: 'boom'
    });
  });

  test('an empty string is refused before any request', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    await expect(client.verify('')).rejects.toThrow(TypeError);
    expect(fetch.calls).toHaveLength(0);
  });
});

describe('DidClient redeem', () => {
  const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
  const RESULT = 'sealed-result-value';
  const CHALLENGE = 'challenge-123';

  function redeemClient (status, body, extra = {}) {
    const fetch = fakeFetch(() => response(status, body));
    const client = new DidClient(Object.assign({
      resourceKey: RESOURCE, licenceKey: LICENCE, endpoint: ENDPOINT, fetch
    }, extra));
    return { client, fetch };
  }

  test('sends a POST form with the five fields and no key in the URL', async () => {
    const { client, fetch } = redeemClient(200, {
      signature: 'verified',
      context: 'verified',
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 2
    });
    await client.redeem(fod, RESULT, CHALLENGE);
    expect(fetch.calls).toHaveLength(1);
    const call = fetch.calls[0];
    expect(call.url).toBe(ENDPOINT + 'id/redeem');
    expect(call.url).not.toContain(LICENCE);
    expect(call.url).not.toContain(RESOURCE);
    expect(call.url).not.toContain('?');
    expect(call.init.method).toBe('POST');
    expect(call.init.headers['User-Agent']).toBe(USER_AGENT);
    expect(call.init.headers['Content-Type'])
      .toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(call.init.body);
    expect(form.get('51did')).toBe(fod.asBase64Url());
    expect(form.get('result')).toBe(RESULT);
    expect(form.get('challenge')).toBe(CHALLENGE);
    expect(form.get('license')).toBe(LICENCE);
    expect(form.get('resource')).toBe(RESOURCE);
    expect(Array.from(form.keys()).sort())
      .toEqual(['51did', 'challenge', 'license', 'resource', 'result']);
  });

  test('omits license when no licence key was given', async () => {
    const { client, fetch } = redeemClient(200, { context: 'unreadable' }, {
      licenceKey: undefined
    });
    await client.redeem(fod, RESULT, CHALLENGE);
    const form = new URLSearchParams(fetch.calls[0].init.body);
    expect(form.has('license')).toBe(false);
    expect(Array.from(form.keys()).sort())
      .toEqual(['51did', 'challenge', 'resource', 'result']);
  });

  test('a missing challenge is sent empty', async () => {
    const { client, fetch } = redeemClient(200, { context: 'unreadable' });
    await client.redeem(fod.asBase64(), RESULT);
    const form = new URLSearchParams(fetch.calls[0].init.body);
    expect(form.get('challenge')).toBe('');
    expect(form.get('51did')).toBe(fod.asBase64());
  });

  test('an over-long encoded value is refused before transport', async () => {
    const { client, fetch } = redeemClient(200, { context: 'unreadable' });
    await expect(client.redeem(OVER_LONG, RESULT, CHALLENGE))
      .rejects.toBeInstanceOf(DidArgumentError);
    expect(fetch.calls).toHaveLength(0);
  });

  test('redeemed with factors (mismatch)', async () => {
    const body = {
      signature: 'verified',
      context: 'mismatch',
      factors: {
        transport: 'verified',
        device: 'mismatch',
        browserip: 'verified',
        connectionip: 'mismatch',
        asn: 'verified',
        browser: null
      },
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 2
    };
    const { client } = redeemClient(200, body);
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result).toBeInstanceOf(RedeemResult);
    expect(result.statusCode).toBe(200);
    expect(result.context).toBe(ContextResult.MISMATCH);
    expect(result.contextRaw).toBe('mismatch');
    expect(result.signature).toBe(SignatureResult.VERIFIED);
    expect(result.factors).toEqual(body.factors);
    expect(Object.isFrozen(result.factors)).toBe(true);
    expect(result.verifiedAt).toEqual(new Date('2026-08-07T09:15:32Z'));
    expect(result.secondsSinceVerified).toBe(2);
    expect(result.raw).toBe(JSON.stringify(body));
    expect(result.toJSON()).toEqual(body);
  });

  test('redeemed without factors (verified)', async () => {
    const body = {
      signature: 'verified',
      context: 'verified',
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 0
    };
    const { client } = redeemClient(200, body);
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.VERIFIED);
    expect(result.signature).toBe(SignatureResult.VERIFIED);
    expect(result.factors).toBeUndefined();
    expect(result.secondsSinceVerified).toBe(0);
    expect(result.toJSON()).toEqual(body);
  });

  test('redeemed with an invalid signature', async () => {
    const { client } = redeemClient(200, {
      signature: 'invalid',
      context: 'verified',
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 1
    });
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.signature).toBe(SignatureResult.INVALID);
  });

  test('expired', async () => {
    const body = {
      context: 'expired',
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 14
    };
    const { client } = redeemClient(200, body);
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.EXPIRED);
    expect(result.signature).toBe(SignatureResult.UNKNOWN);
    expect(result.verifiedAt).toEqual(new Date('2026-08-07T09:15:32Z'));
    expect(result.secondsSinceVerified).toBe(14);
    expect(result.toJSON()).toEqual(body);
  });

  test('replayed', async () => {
    const { client } = redeemClient(200, { context: 'replayed' });
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.REPLAYED);
    expect(result.verifiedAt).toBeUndefined();
    expect(result.secondsSinceVerified).toBeUndefined();
    expect(result.toJSON()).toEqual({ context: 'replayed' });
  });

  test('unreadable', async () => {
    const { client } = redeemClient(200, { context: 'unreadable' });
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.UNREADABLE);
    expect(result.signature).toBe(SignatureResult.UNKNOWN);
  });

  test('nocontext and notcheckable', async () => {
    for (const context of ['nocontext', 'notcheckable']) {
      const { client } = redeemClient(200, {
        signature: 'verified',
        context,
        verifiedAt: '2026-08-07T09:15:32Z',
        secondsSinceVerified: 1
      });
      const result = await client.redeem(fod, RESULT, CHALLENGE);
      expect(result.context).toBe(context);
    }
  });

  test('503 unconfirmed is a result the caller may retry', async () => {
    const { client } = redeemClient(503, { context: 'unconfirmed' });
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.statusCode).toBe(503);
    expect(result.context).toBe(ContextResult.UNCONFIRMED);
  });

  test('an unknown context string fails closed and keeps the raw value', async () => {
    const { client } = redeemClient(200, { context: 'splendid', signature: 'verified' });
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.UNREADABLE);
    expect(result.contextRaw).toBe('splendid');
    expect(result.toJSON().context).toBe('unreadable');
  });

  test('a missing context fails closed', async () => {
    const { client } = redeemClient(200, {});
    const result = await client.redeem(fod, RESULT, CHALLENGE);
    expect(result.context).toBe(ContextResult.UNREADABLE);
    expect(result.contextRaw).toBe('');
  });

  test('400 errors raises DidArgumentError with the cloud message', async () => {
    const { client } = redeemClient(400, {
      errors: ['Value for 51did is not a valid Base64-encoded 51Did: \'x\'.']
    });
    await expect(client.redeem('x', RESULT, CHALLENGE)).rejects.toMatchObject({
      name: 'DidArgumentError',
      statusCode: 400,
      message: 'Value for 51did is not a valid Base64-encoded 51Did: \'x\'.'
    });
  });

  test('404 raises DidNotSupportedError', async () => {
    const { client } = redeemClient(404, 'Not found');
    const rejection = expect(client.redeem(fod, RESULT, CHALLENGE)).rejects;
    await rejection.toBeInstanceOf(DidNotSupportedError);
    await expect(client.redeem(fod, RESULT, CHALLENGE)).rejects.toMatchObject({
      statusCode: 404, body: 'Not found'
    });
  });

  test('another status raises DidClientError', async () => {
    const { client } = redeemClient(500, 'boom');
    await expect(client.redeem(fod, RESULT, CHALLENGE)).rejects.toMatchObject({
      name: 'DidClientError', statusCode: 500, body: 'boom'
    });
  });

  test('a 200 that is not a JSON object raises DidClientError', async () => {
    const { client } = redeemClient(200, 'not json');
    await expect(client.redeem(fod, RESULT, CHALLENGE)).rejects.toMatchObject({
      name: 'DidClientError', statusCode: 200, body: 'not json'
    });
  });

  test('a transport failure propagates', async () => {
    const fetch = fakeFetch(() => { throw new TypeError('fetch failed'); });
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await expect(client.redeem(fod, RESULT, CHALLENGE)).rejects.toThrow('fetch failed');
  });
});

describe('RedeemResult.fromResponse', () => {
  test('builds from a body and refuses a non-object', () => {
    const result = RedeemResult.fromResponse(200, '{"context":"verified"}');
    expect(result.context).toBe(ContextResult.VERIFIED);
    expect(() => RedeemResult.fromResponse(200, '[]')).toThrow(DidClientError);
    expect(() => RedeemResult.fromResponse(200, 'x')).toThrow(DidClientError);
  });

  test('toJSON writes verifiedAt to the second', () => {
    const result = RedeemResult.fromResponse(200, JSON.stringify({
      context: 'verified',
      signature: 'verified',
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 3
    }));
    expect(result.toJSON().verifiedAt).toBe('2026-08-07T09:15:32Z');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result.toJSON());
  });
});
