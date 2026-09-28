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
  FactorResult,
  Factor,
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
const layout = require('../internal/layout');

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

// Values the reader refuses, with the status the client names for each, so
// the tests can show that nothing leaves the process for any of them.
const MALFORMED = [
  ['This is not valid Base64!@#', FodId.ParseStatus.INVALID_BASE64],
  // Version 2 and a domain that never terminates, so the envelope ends
  // part way through a field.
  [Buffer.from([2, 0x61]).toString('base64'), FodId.ParseStatus.UNEXPECTED_END],
  [envelopeBase64(new Uint8Array(2)), FodId.ParseStatus.PAYLOAD_TOO_SHORT],
  [envelopeBase64(canonicalRandomPayload().slice(0, 20)),
    FodId.ParseStatus.INVALID_TYPE_PAYLOAD_LENGTH]
];

// Three weekly periods, Monday to Monday, as the cloud's generator writes.
const START_1 = new Date('2026-08-03T00:00:00Z');
const START_2 = new Date('2026-08-10T00:00:00Z');
const START_3 = new Date('2026-08-17T00:00:00Z');
const START_4 = new Date('2026-08-24T00:00:00Z');

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

/**
 * One entry as the cloud's key route publishes it, with the dates in the
 * form the cloud writes them and endsAt where one is given.
 * @param {Date} startsAt when the key starts
 * @param {Date | null} endsAt when the key ends, or null for none
 * @param {string} publicKey the key as PEM
 * @returns {object} the published entry
 */
function published (startsAt, endsAt, publicKey) {
  const cloudDate = (date) => date.toISOString().replace(/Z$/, '0000Z');
  const entry = { startsAt: cloudDate(startsAt), publicKey };
  if (endsAt !== null) {
    entry.endsAt = cloudDate(endsAt);
  }
  return entry;
}

/**
 * A client on a clock the test moves, whose key requests are answered with
 * the entries the test has published, filtered on the datetime parameter as
 * the cloud's key route filters them, once `cloud.answering` resolves.
 * @param {number} now the clock's first reading
 * @returns {{client: DidClient, fetch: Function, cloud: object}} the
 * client, the fetch stand-in, and the published entries with the clock
 */
function publishingClient (now) {
  const cloud = { entries: [], now, answering: Promise.resolve() };
  const fetch = fakeFetch(async (url) => {
    if (url.indexOf('id/key/') < 0) {
      throw new Error('unexpected request ' + url);
    }
    await cloud.answering;
    const datetime = new URL(url).searchParams.get('datetime');
    return response(200, cloud.entries.filter((entry) => datetime === null ||
      new Date(entry.startsAt) >= new Date(datetime)));
  });
  const client = new DidClient({
    resourceKey: RESOURCE, endpoint: ENDPOINT, fetch, now: () => cloud.now
  });
  return { client, fetch, cloud };
}

/**
 * The datetime parameter a recorded key request carried.
 * @param {object} call the recorded request
 * @returns {Date | null} the moment, or null when the request had none
 */
function datetimeOf (call) {
  const value = new URL(call.url).searchParams.get('datetime');
  return value === null ? null : new Date(value);
}

/**
 * Runs the function with no `process` global, as a page has none, and puts
 * the global back once the function returns. A request the function starts
 * is made before the function returns, so its headers are chosen without
 * the global.
 * @param {function(): any} fn the function to run
 * @returns {any} what the function returned
 */
function withoutProcess (fn) {
  const saved = globalThis.process;
  globalThis.process = undefined;
  try {
    return fn();
  } finally {
    globalThis.process = saved;
  }
}

/**
 * A fetch stand-in that refuses to run as a method of anything but the
 * window, as a browser's fetch does, and otherwise answers from a handler.
 * @param {function(string, object, number): object} handler given the URL,
 * the init and the call number, returns a response
 * @returns {Function} the fetch function, with a `calls` array
 */
function windowFetch (handler) {
  const calls = [];
  const fetch = async function (url, init) {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError('Illegal invocation');
    }
    const call = { url: String(url), init: init || {} };
    calls.push(call);
    return handler(call.url, call.init, calls.length);
  };
  fetch.calls = calls;
  return fetch;
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

// A page builds a client with only the resource key. A browser has no
// process global to read an endpoint from, runs its fetch only as a
// function of the window, and sends its own User-Agent, where one set by
// the client would make every request need a preflight.
describe('DidClient in a browser', () => {
  const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
  const saved = process.env.FOD_CLOUD_API_URL;
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.FOD_CLOUD_API_URL;
    } else {
      process.env.FOD_CLOUD_API_URL = saved;
    }
  });

  /**
   * A fetch stand-in answering the key, verify and redeem routes.
   * @param {object[]} json the published key list
   * @returns {Function} the fetch function, with a `calls` array
   */
  function cloudFetch (json) {
    return fakeFetch((url) => {
      if (url.indexOf('id/key/') >= 0) {
        return response(200, json);
      }
      if (url.indexOf('id/verify/') >= 0) {
        return response(200, { valid: true });
      }
      return response(200, { signature: 'verified', context: 'verified' });
    });
  }

  test('the endpoint defaults to the public cloud where there is no process global', () => {
    process.env.FOD_CLOUD_API_URL = 'https://other.example/api/v4';
    const client = withoutProcess(() =>
      new DidClient({ resourceKey: RESOURCE, fetch: fakeFetch(() => null) }));
    expect(client.endpoint).toBe('https://cloud.51degrees.com/api/v4/');
  });

  test('the global fetch is called as a function of the window, never as a method of the client', async () => {
    const { json } = await schedule();
    const fetch = windowFetch(() => response(200, json));
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    globalThis.fetch = fetch;
    try {
      const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT });
      await expect(client.publicKeys()).resolves.toHaveLength(3);
      // A fetch passed in is called the same way.
      const passed = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
      await expect(passed.publicKeys()).resolves.toHaveLength(3);
      expect(fetch.calls).toHaveLength(2);
    } finally {
      if (descriptor === undefined) {
        delete globalThis.fetch;
      } else {
        Object.defineProperty(globalThis, 'fetch', descriptor);
      }
    }
  });

  test('no User-Agent header is sent, so every request is a simple one', async () => {
    const { json } = await schedule();
    const fetch = cloudFetch(json);
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await withoutProcess(() => Promise.all([
      client.publicKeys(),
      client.verify(fod),
      client.redeem(fod, 'sealed', 'challenge')
    ]));
    expect(fetch.calls.map((call) => call.init.headers)).toEqual([
      {},
      {},
      { 'Content-Type': 'application/x-www-form-urlencoded' }
    ]);
  });

  test('on Node every request names the package in User-Agent', async () => {
    const { json } = await schedule();
    const fetch = cloudFetch(json);
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await Promise.all([
      client.publicKeys(),
      client.verify(fod),
      client.redeem(fod, 'sealed', 'challenge')
    ]);
    expect(fetch.calls.map((call) => call.init.headers)).toEqual([
      { 'User-Agent': USER_AGENT },
      { 'User-Agent': USER_AGENT },
      {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    ]);
  });
});

// A private cloud serves the key, verify and redeem routes with no resource
// key, so a client for one is built with the endpoint alone and sends no
// resource segment and no resource form field. The public cloud takes the
// key on every route, so a client for it still needs one.
describe('DidClient without a resource key', () => {
  const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));
  const saved = process.env.FOD_CLOUD_API_URL;
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.FOD_CLOUD_API_URL;
    } else {
      process.env.FOD_CLOUD_API_URL = saved;
    }
  });

  test('is built with the endpoint alone', () => {
    const client = new DidClient({ endpoint: ENDPOINT, fetch: fakeFetch(() => null) });
    expect(client.resourceKey).toBeNull();
    expect(client.endpoint).toBe(ENDPOINT);
    // An endpoint from the environment serves as well.
    process.env.FOD_CLOUD_API_URL = ENDPOINT;
    expect(new DidClient({ fetch: fakeFetch(() => null) }).resourceKey)
      .toBeNull();
  });

  test('the public cloud still needs one', () => {
    delete process.env.FOD_CLOUD_API_URL;
    const fetch = fakeFetch(() => null);
    expect(() => new DidClient({ fetch })).toThrow(TypeError);
    expect(() => new DidClient({
      endpoint: 'https://cloud.51degrees.com/api/v4', fetch
    })).toThrow(TypeError);
    // An empty key is a missing one, never a private cloud.
    expect(() => new DidClient({ endpoint: ENDPOINT, resourceKey: '', fetch }))
      .toThrow(TypeError);
  });

  test('fetches the keys from id/key with no resource segment', async () => {
    const { pairs, json } = await schedule();
    const fetch = fakeFetch(() => response(200, json));
    const client = new DidClient({ endpoint: ENDPOINT, fetch });
    await expect(client.publicKeys()).resolves.toHaveLength(3);
    expect(fetch.calls[0].url).toBe(ENDPOINT + 'id/key');
    // Dated after the newest start held, so the keys from that start
    // onwards are asked for.
    await client.publicKeyFor(
      await signedAt(pairs[2], new Date(START_3.getTime() + DAY)));
    expect(fetch.calls[1].url).toBe(ENDPOINT + 'id/key?datetime=' +
      encodeURIComponent(START_3.toISOString().replace(/\.\d+Z$/, 'Z')));
  });

  test('verifies through id/verify with no resource segment', async () => {
    const fetch = fakeFetch(() => response(200, { valid: true }));
    const client = new DidClient({ endpoint: ENDPOINT, fetch });
    await expect(client.verify(fod)).resolves.toBe(true);
    const id = encodeURIComponent(fod.asBase64Url());
    expect(fetch.calls[0].url)
      .toBe(ENDPOINT + 'id/verify?51did=' + id + '&owid=' + id);
  });

  test('redeems through id/redeem with no resource field', async () => {
    const fetch = fakeFetch(() =>
      response(200, { signature: 'verified', context: 'verified' }));
    const client = new DidClient({
      endpoint: ENDPOINT, licenceKey: LICENCE, fetch
    });
    const redeemed = await client.redeem(fod, 'sealed', 'challenge');
    expect(redeemed.context).toBe('verified');
    expect(fetch.calls[0].url).toBe(ENDPOINT + 'id/redeem');
    const form = new URLSearchParams(fetch.calls[0].init.body);
    expect(form.has('resource')).toBe(false);
    expect(Array.from(form.keys()).sort())
      .toEqual(['51did', 'challenge', 'license', 'result']);
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

  test('keeps endsAt, read from the form the cloud writes', async () => {
    const { pems } = await schedule();
    const { client } = keyClient([
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ]);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.endsAt)).toEqual([START_2, START_3]);
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

  test('no refetch when the list held covers the date', async () => {
    const { pairs, json } = await schedule();
    let now = START_2.getTime() + DAY;
    const { client, fetch } = keyClient(json, { now: () => now });
    await client.publicKeyFor(await signedAt(pairs[0], new Date(START_1.getTime() + DAY)));
    now += 5 * MINUTE;
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    now += 5 * MINUTE;
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_3.getTime() - HOUR)));
    expect(fetch.calls).toHaveLength(1);
  });

  test('refetches when the date is later than the newest start, at most once a minute', async () => {
    const { pairs, json } = await schedule();
    let now = START_2.getTime() + DAY;
    const { client, fetch } = keyClient(json, { now: () => now });
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    expect(fetch.calls).toHaveLength(1);
    now += MINUTE;
    const later = await signedAt(pairs[2], new Date(START_3.getTime() + DAY));
    const key = await client.publicKeyFor(later);
    expect(key.startsAt).toEqual(START_3);
    expect(fetch.calls).toHaveLength(2);
    // Without endsAt the newest key still answers. A later date asks again
    // once a minute, never on every lookup.
    await client.publicKeyFor(later);
    expect(fetch.calls).toHaveLength(2);
    now += MINUTE;
    await client.publicKeyFor(later);
    expect(fetch.calls).toHaveLength(3);
  });

  test('no refetch for a date before every entry, which no later answer adds', async () => {
    const { pairs, json } = await schedule();
    let now = START_2.getTime() + DAY;
    const { client, fetch } = keyClient(json, { now: () => now });
    await client.publicKeyFor(await signedAt(pairs[1], new Date(START_2.getTime() + DAY)));
    now += 5 * MINUTE;
    const early = await signedAt(pairs[0], new Date(START_1.getTime() - DAY));
    expect(await client.publicKeyFor(early)).toBeNull();
    expect(fetch.calls).toHaveLength(1);
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
    // The daily fetch is of the whole list.
    expect(datetimeOf(fetch.calls[0])).toBeNull();
    expect(datetimeOf(fetch.calls[1])).toBeNull();
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

// The cloud publishes each key only from shortly before its period starts,
// with endsAt, and may replace a key before its endsAt. The client verifies
// offline until the newest key it holds ends.
describe('DidClient key list end dates', () => {
  test('no request inside the period of a newest key that ends later', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } =
      publishingClient(START_3.getTime() - 30 * MINUTE);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    for (const at of [
      new Date(START_2.getTime() + MINUTE),
      new Date(START_2.getTime() + DAY),
      new Date(START_2.getTime() + 3 * DAY),
      new Date(START_2.getTime() + 6 * DAY),
      new Date(START_3.getTime() - HOUR)
    ]) {
      await expect(client.verifySignatureDetailed(await signedAt(pairs[1], at)))
        .resolves.toEqual({ valid: true, reason: SignatureReason.VERIFIED });
      // Past the minute between requests, so only the end of the list
      // held keeps them from being made.
      cloud.now += 5 * MINUTE;
    }
    expect(fetch.calls).toHaveLength(1);
    expect(datetimeOf(fetch.calls[0])).toBeNull();
  });

  test('a 51Did dated close to the end of the list held fetches from the newest start and verifies with the new key', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } =
      publishingClient(START_3.getTime() - 20 * MINUTE);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    // The next key is published shortly before it starts, and a creator
    // may sign with it in the minutes before.
    cloud.entries.push(published(START_3, START_4, pems[2]));
    cloud.now += 10 * MINUTE;
    const early = await signedAt(pairs[2], new Date(START_3.getTime() - MINUTE));
    // Too close to the end of the list held for it to answer, so the list
    // is fetched before any key is chosen or signature checked.
    await expect(client.publicKeyFor(early)).resolves.toMatchObject({
      startsAt: START_2
    });
    expect(fetch.calls).toHaveLength(2);
    expect(datetimeOf(fetch.calls[1])).toEqual(START_2);
    await expect(client.verifySignatureDetailed(early)).resolves.toEqual({
      valid: true, reason: SignatureReason.VERIFIED
    });
    expect(fetch.calls).toHaveLength(2);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2, START_3]);
    expect(keys.map((k) => k.endsAt)).toEqual([START_2, START_3, START_4]);
    // The merged list reaches through the next period.
    cloud.now += 5 * MINUTE;
    const next = await signedAt(pairs[2], new Date(START_3.getTime() + DAY));
    await expect(client.verifySignature(next)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(2);
  });

  test('a 51Did dated after the end of the list held verifies once the next key is fetched', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_3.getTime() - HOUR);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    cloud.entries.push(published(START_3, START_4, pems[2]));
    cloud.now = START_3.getTime() + 2 * HOUR;
    const after = await signedAt(pairs[2], new Date(START_3.getTime() + HOUR));
    await expect(client.verifySignature(after)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(2);
    expect(datetimeOf(fetch.calls[1])).toEqual(START_2);
  });

  test('no request for a current 51Did against a list without endsAt that holds later keys', async () => {
    const { pairs, json } = await schedule();
    let now = START_2.getTime() + DAY;
    const { client, fetch } = keyClient(json, { now: () => now });
    for (let i = 0; i < 3; i++) {
      const current = await signedAt(pairs[1], new Date(now));
      await expect(client.verifySignature(current)).resolves.toBe(true);
      now += 5 * MINUTE;
    }
    expect(fetch.calls).toHaveLength(1);
  });

  test('51Dids dated past the end where nothing newer is published make one request a minute and answer nokey', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    cloud.now += 2 * MINUTE;
    const unpublished = await generateKeyPair();
    const first = await signedAt(unpublished, new Date(START_3.getTime() + HOUR));
    const second = await signedAt(unpublished, new Date(START_3.getTime() + 2 * HOUR));
    // Signed with the newest key held, but dated where it has ended.
    const forged = await signedAt(pairs[1], new Date(START_3.getTime() + DAY));
    const noKey = { valid: false, reason: SignatureReason.NO_KEY };
    await expect(client.verifySignatureDetailed(first)).resolves.toEqual(noKey);
    await expect(client.verifySignatureDetailed(second)).resolves.toEqual(noKey);
    await expect(client.verifySignatureDetailed(forged)).resolves.toEqual(noKey);
    await expect(client.publicKeyFor(second)).resolves.toBeNull();
    expect(fetch.calls).toHaveLength(2);
    expect(datetimeOf(fetch.calls[1])).toEqual(START_2);
    cloud.now += MINUTE;
    await expect(client.verifySignatureDetailed(second)).resolves.toEqual(noKey);
    expect(fetch.calls).toHaveLength(3);
  });

  test('a later answer with endsAt replaces a held entry without it', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, null, pems[0]),
      published(START_2, null, pems[1])
    ];
    const current = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    await expect(client.verifySignature(current)).resolves.toBe(true);
    // Without endsAt the list held ends at its newest start, so the next
    // check asks from there.
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await expect(client.verifySignature(current)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(2);
    expect(datetimeOf(fetch.calls[1])).toEqual(START_2);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2]);
    // The first entry was not in the answer, so it is kept as it was held.
    expect(keys[0].endsAt).toBeUndefined();
    expect(keys[1].endsAt).toEqual(START_3);
    cloud.now += 5 * MINUTE;
    const later = await signedAt(pairs[1], new Date(START_3.getTime() - HOUR));
    await expect(client.verifySignature(later)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(2);
  });

  test('a key replaced part way through its period is picked up on the first signature that fails', async () => {
    const { pairs, pems } = await schedule();
    const replacement = await generateKeyPair();
    const replacedAt = new Date(START_2.getTime() + 3 * DAY);
    const { client, fetch, cloud } =
      publishingClient(replacedAt.getTime() - HOUR);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    // The cloud ends the key early and publishes the replacement from then.
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, replacedAt, pems[1]),
      published(replacedAt, START_3, await publicPemOf(replacement))
    ];
    cloud.now = replacedAt.getTime() + HOUR;
    const after = new Date(replacedAt.getTime() + 30 * MINUTE);
    const genuine = await signedAt(replacement, after);
    await expect(client.verifySignatureDetailed(genuine)).resolves.toEqual({
      valid: true, reason: SignatureReason.VERIFIED
    });
    expect(fetch.calls).toHaveLength(2);
    expect(datetimeOf(fetch.calls[1])).toEqual(START_2);
    // The replaced key no longer answers after the replacement.
    const oldKey = await signedAt(pairs[1], after);
    await expect(client.verifySignatureDetailed(oldKey)).resolves.toEqual({
      valid: false, reason: SignatureReason.SIGNATURE
    });
    // It still answers for its own, now shorter, period, and as the
    // neighbouring key in the minutes after the replacement starts.
    const before = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    await expect(client.verifySignature(before)).resolves.toBe(true);
    const justAfter =
      await signedAt(pairs[1], new Date(replacedAt.getTime() + MINUTE));
    await expect(client.verifySignature(justAfter)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(2);
  });

  test('after a failed signature the keys are fetched from the start of the one in force at its date', async () => {
    const { pems } = await schedule();
    const replacement = await generateKeyPair();
    const replacedAt = new Date(START_2.getTime() + 3 * DAY);
    const { client, fetch, cloud } =
      publishingClient(replacedAt.getTime() - HOUR);
    // A list from a cloud that sends no endsAt and publishes keys before
    // they start, so a later key than the one in force is held.
    cloud.entries = [
      published(START_1, null, pems[0]),
      published(START_2, null, pems[1]),
      published(START_3, null, pems[2])
    ];
    await client.publicKeys();
    // The cloud now publishes only keys that have started, and has
    // replaced the one in force.
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, replacedAt, pems[1]),
      published(replacedAt, START_3, await publicPemOf(replacement))
    ];
    cloud.now = replacedAt.getTime() + HOUR;
    const genuine = await signedAt(
      replacement, new Date(replacedAt.getTime() + 30 * MINUTE));
    await expect(client.verifySignature(genuine)).resolves.toBe(true);
    expect(fetch.calls.map(datetimeOf)).toEqual([null, START_2]);
  });

  test('fetches of the whole list neither count toward the minute nor are held back by it', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    const pastTheEnd =
      await signedAt(pairs[1], new Date(START_3.getTime() + HOUR));
    await client.publicKeyFor(pastTheEnd);
    await client.publicKeyFor(pastTheEnd);
    expect(fetch.calls.map(datetimeOf)).toEqual([null, START_2]);
    cloud.now += DAY + MINUTE;
    await client.publicKeyFor(pastTheEnd);
    await client.publicKeyFor(pastTheEnd);
    expect(fetch.calls.map(datetimeOf))
      .toEqual([null, START_2, null, START_2]);
  });

  test('only a fetch of the whole list resets its age', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    const current = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    const pastTheEnd =
      await signedAt(pairs[1], new Date(START_3.getTime() + HOUR));
    await client.verifySignature(current);
    cloud.now += 12 * HOUR;
    await client.publicKeyFor(pastTheEnd);
    cloud.now += 13 * HOUR;
    await client.verifySignature(current);
    expect(fetch.calls.map(datetimeOf)).toEqual([null, START_2, null]);
  });

  test('an answer with an entry that does not end after it starts is refused, and none of it is merged', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } =
      publishingClient(START_3.getTime() - 20 * MINUTE);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    cloud.entries = [
      published(START_2, START_2, pems[1]),
      published(START_3, START_4, pems[2])
    ];
    cloud.now += 10 * MINUTE;
    const early = await signedAt(pairs[2], new Date(START_3.getTime() - MINUTE));
    await expect(client.verifySignatureDetailed(early))
      .rejects.toBeInstanceOf(DidClientError);
    expect(fetch.calls).toHaveLength(2);
    const keys = await client.publicKeys();
    expect(keys.map((k) => k.startsAt)).toEqual([START_1, START_2]);
    expect(keys[1].endsAt).toEqual(START_3);
  });

  test('a signature that fails against a list fetched for the same check is not checked again', async () => {
    const { pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    const forged = await signedAt(
      await generateKeyPair(), new Date(START_2.getTime() + DAY));
    await expect(client.verifySignatureDetailed(forged)).resolves.toEqual({
      valid: false, reason: SignatureReason.SIGNATURE
    });
    expect(fetch.calls).toHaveLength(1);
  });

  test('failed signatures inside the period make at most one request a minute', async () => {
    const { pems } = await schedule();
    const { client, fetch, cloud } = publishingClient(START_2.getTime() + DAY);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    cloud.now += 2 * MINUTE;
    const forger = await generateKeyPair();
    const failed = { valid: false, reason: SignatureReason.SIGNATURE };
    for (let i = 0; i < 3; i++) {
      const forged = await signedAt(
        forger, new Date(START_2.getTime() + DAY + i * MINUTE));
      await expect(client.verifySignatureDetailed(forged))
        .resolves.toEqual(failed);
    }
    expect(fetch.calls).toHaveLength(2);
    cloud.now += MINUTE;
    const forged = await signedAt(forger, new Date(START_2.getTime() + DAY));
    await expect(client.verifySignatureDetailed(forged)).resolves.toEqual(failed);
    expect(fetch.calls).toHaveLength(3);
  });

  test('callers at the same moment share one request', async () => {
    const { pairs, pems } = await schedule();
    const { client, fetch, cloud } =
      publishingClient(START_3.getTime() - 20 * MINUTE);
    cloud.entries = [
      published(START_1, START_2, pems[0]),
      published(START_2, START_3, pems[1])
    ];
    await client.publicKeys();
    cloud.entries.push(published(START_3, START_4, pems[2]));
    cloud.now = START_3.getTime() + 10 * MINUTE;
    const first = await signedAt(pairs[2], new Date(START_3.getTime() + MINUTE));
    const second = await signedAt(pairs[2], new Date(START_3.getTime() + 2 * MINUTE));
    // The answer is held back until both callers are seen waiting on it.
    let release;
    cloud.answering = new Promise((resolve) => { release = resolve; });
    const settled = [];
    const checks = [first, second].map((fodId, i) =>
      client.verifySignature(fodId).then((valid) => {
        settled.push(i);
        return valid;
      }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch.calls).toHaveLength(2);
    expect(settled).toEqual([]);
    release();
    await expect(Promise.all(checks)).resolves.toEqual([true, true]);
    expect(fetch.calls).toHaveLength(2);
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

  // The dates either side of a boundary sit well clear of the allowance the
  // client applies, a minute out where the neighbouring key must still be
  // tried and an hour out where it must not, so these tests show the rule
  // holds without recording how wide the allowance is.
  test('true with the earlier neighbour just after a boundary', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_2.getTime() + MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('false with the earlier key beyond the tolerance', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[0], new Date(START_2.getTime() + HOUR));
    await expect(client.verifySignatureDetailed(fod)).resolves.toEqual({
      valid: false, reason: SignatureReason.SIGNATURE
    });
  });

  test('true with the later neighbour just before a boundary', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[2], new Date(START_3.getTime() - MINUTE));
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('false with the later key beyond the tolerance', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const fod = await signedAt(pairs[2], new Date(START_3.getTime() - HOUR));
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
    const fod = await signedAt(pairs[0], new Date(START_1.getTime() - MINUTE));
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
    short[layout.FLAGS_OFFSET] = 0b11000001;
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
    const withContext = new Uint8Array(layout.PAYLOAD_LENGTH + 40);
    withContext.set(canonicalPayload());
    withContext.fill(0x5A, layout.PAYLOAD_LENGTH);
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY), {
      payload: withContext
    });
    await expect(client.verifySignature(fod)).resolves.toBe(true);
  });

  test('true for a long context section and a long creator domain', async () => {
    const { pairs, json } = await schedule();
    const { client } = keyClient(json);
    const withContext = new Uint8Array(layout.PAYLOAD_LENGTH + 200);
    withContext.set(canonicalPayload());
    withContext.fill(0x5A, layout.PAYLOAD_LENGTH);
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

  test('a malformed identifier is refused with the reader status before any key fetch', async () => {
    const { client, fetch } = keyClient([]);
    for (const [input, status] of MALFORMED) {
      for (const call of [
        () => client.verifySignature(input),
        () => client.verifySignatureDetailed(input),
        () => client.publicKeyFor(input)
      ]) {
        await expect(call()).rejects.toMatchObject({
          name: 'DidArgumentError',
          message: expect.stringContaining('(' + status + ')')
        });
      }
    }
    expect(fetch.calls).toHaveLength(0);
  });

  test('the length guard and the reader are separate checks', async () => {
    // The guard is client policy on the encoded length, applied before the
    // reader sees the value. A value under the guard that is not a 51Did
    // is refused by the reader with its status, and a value over the guard
    // is refused by the guard with its own message. Whitespace at either
    // end is ignored by the guard as the reader ignores it, so a genuine
    // identifier padded out with whitespace still passes both.
    const { pairs, json } = await schedule();
    const { client, fetch } = keyClient(json);
    await expect(client.verifySignature('*'.repeat(4000)))
      .rejects.toMatchObject({
        message: expect.stringContaining(FodId.ParseStatus.INVALID_BASE64)
      });
    await expect(client.verifySignature(OVER_LONG))
      .rejects.toMatchObject({
        message: 'The value is longer than this client will read as a 51Did.'
      });
    const genuine = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    const spaced = genuine.asBase64() + ' '.repeat(8192);
    await expect(client.verifySignature(spaced)).resolves.toBe(true);
    const inner = genuine.asBase64() + '\n';
    await expect(client.verifySignature(inner)).resolves.toBe(true);
    const padded = ' '.repeat(4096) + genuine.asBase64Url();
    await expect(client.verifySignature(padded)).resolves.toBe(true);
    expect(fetch.calls).toHaveLength(1);
  });

  test('a key list that cannot be fetched is an error, never an invalid signature', async () => {
    const { pairs } = await schedule();
    const fod = await signedAt(pairs[1], new Date(START_2.getTime() + DAY));
    const fetch = fakeFetch(() => response(503, 'unavailable'));
    const client = new DidClient({ resourceKey: RESOURCE, endpoint: ENDPOINT, fetch });
    await expect(client.verifySignatureDetailed(fod)).rejects.toMatchObject({
      name: 'DidClientError', statusCode: 503
    });
    await expect(client.verifySignature(fod))
      .rejects.toBeInstanceOf(DidClientError);
    const unreachable = fakeFetch(() => { throw new TypeError('fetch failed'); });
    const offline = new DidClient({
      resourceKey: RESOURCE, endpoint: ENDPOINT, fetch: unreachable
    });
    await expect(offline.verifySignature(fod)).rejects.toThrow('fetch failed');
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
    // A value that reads as a 51Did here can still be refused by the cloud,
    // which then answers with its own message and is relayed as given.
    const { client } = verifyClient(400, {
      errors: ['Value for 51did is not a valid Base64-encoded 51Did: \'x\'.']
    });
    await expect(client.verify(fod)).rejects.toMatchObject({
      name: 'DidArgumentError',
      statusCode: 400,
      message: 'Value for 51did is not a valid Base64-encoded 51Did: \'x\'.'
    });
    await expect(client.verify(fod)).rejects.toBeInstanceOf(DidArgumentError);
    await expect(client.verify(fod)).rejects.toBeInstanceOf(DidClientError);
  });

  test('a malformed identifier is refused with the reader status before any request', async () => {
    const { client, fetch } = verifyClient(200, { valid: true });
    for (const [input, status] of MALFORMED) {
      await expect(client.verify(input)).rejects.toMatchObject({
        name: 'DidArgumentError',
        statusCode: undefined,
        message: expect.stringContaining('(' + status + ')')
      });
    }
    expect(fetch.calls).toHaveLength(0);
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
        platformname: 'verified',
        platformversion: 'mismatch',
        browsername: 'verified',
        browserversion: null
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

  test('the four platform and browser factors are read into their names',
    async () => {
      const body = {
        signature: 'verified',
        context: 'mismatch',
        factors: {
          transport: 'verified',
          device: 'verified',
          browserip: 'verified',
          connectionip: 'verified',
          asn: 'verified',
          platformname: 'verified',
          platformversion: 'mismatch',
          browsername: 'mismatch',
          browserversion: 'misconfigured'
        }
      };
      const { client } = redeemClient(200, body);
      const result = await client.redeem(fod, RESULT, CHALLENGE);
      expect(result.factors).toEqual(body.factors);
      expect(result.factors[Factor.PLATFORM_NAME])
        .toBe(FactorResult.VERIFIED);
      expect(result.factors[Factor.PLATFORM_VERSION])
        .toBe(FactorResult.MISMATCH);
      expect(result.factors[Factor.BROWSER_NAME])
        .toBe(FactorResult.MISMATCH);
      expect(result.factors[Factor.BROWSER_VERSION])
        .toBe(FactorResult.MISCONFIGURED);
    });

  test('the factor names are the nine the cloud lists, in its order', () => {
    expect(Object.isFrozen(Factor)).toBe(true);
    expect(Object.keys(Factor)).toEqual([
      'TRANSPORT', 'DEVICE', 'BROWSER_IP', 'CONNECTION_IP', 'ASN',
      'PLATFORM_NAME', 'PLATFORM_VERSION', 'BROWSER_NAME', 'BROWSER_VERSION'
    ]);
    expect(Object.values(Factor)).toEqual([
      'transport', 'device', 'browserip', 'connectionip', 'asn',
      'platformname', 'platformversion', 'browsername', 'browserversion'
    ]);
  });

  test('an old browser factor populates none of the four, and is kept',
    async () => {
      const body = {
        signature: 'verified',
        context: 'mismatch',
        factors: {
          transport: 'verified',
          device: 'verified',
          browserip: 'verified',
          connectionip: 'verified',
          asn: 'verified',
          browser: 'mismatch'
        }
      };
      const { client } = redeemClient(200, body);
      const result = await client.redeem(fod, RESULT, CHALLENGE);
      expect(result.factors).toBeDefined();
      for (const name of [Factor.PLATFORM_NAME, Factor.PLATFORM_VERSION,
        Factor.BROWSER_NAME, Factor.BROWSER_VERSION]) {
        expect(name in result.factors).toBe(false);
      }
      // Every name passes through as the cloud sent it, as in every other
      // 51Did package.
      expect(result.factors.browser).toBe('mismatch');
      expect(result.factors).toEqual(body.factors);
      expect(result.toJSON().factors).toEqual(body.factors);
    });

  test('a factor name this package does not list is passed through',
    async () => {
      const body = {
        context: 'mismatch',
        factors: { transport: 'verified', laterfactor: 'mismatch' }
      };
      const { client } = redeemClient(200, body);
      const result = await client.redeem(fod, RESULT, CHALLENGE);
      expect(result.factors).toEqual(body.factors);
      expect(Object.isFrozen(result.factors)).toBe(true);
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
    // A value that reads as a 51Did here can still be refused by the cloud,
    // which then answers with its own message and is relayed as given.
    const { client } = redeemClient(400, {
      errors: ['Value for 51did is not a valid Base64-encoded 51Did: \'x\'.']
    });
    await expect(client.redeem(fod, RESULT, CHALLENGE)).rejects.toMatchObject({
      name: 'DidArgumentError',
      statusCode: 400,
      message: 'Value for 51did is not a valid Base64-encoded 51Did: \'x\'.'
    });
  });

  test('a malformed identifier is refused with the reader status before any request', async () => {
    const { client, fetch } = redeemClient(200, { context: 'verified' });
    for (const [input, status] of MALFORMED) {
      await expect(client.redeem(input, RESULT, CHALLENGE))
        .rejects.toMatchObject({
          name: 'DidArgumentError',
          statusCode: undefined,
          message: expect.stringContaining('(' + status + ')')
        });
    }
    expect(fetch.calls).toHaveLength(0);
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
