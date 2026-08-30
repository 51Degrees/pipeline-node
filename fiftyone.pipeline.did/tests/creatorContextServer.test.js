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

// The creator context example's /redeem route, driven with a stand-in
// client so no network is touched. The route must answer in the cloud's
// own shape with serverSignature added, and keep the error paths the page
// relies on.

const { redeemRoute } = require('../examples/creator-context-web/server');
const {
  FodId, RedeemResult, DidNotSupportedError, DidArgumentError, DidClientError
} = require('../index');
const { canonicalPayload, envelopeBase64 } = require('./envelope');

const fod = FodId.fromBase64(envelopeBase64(canonicalPayload()));

function fakeResponse () {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead (status, headers) {
      this.status = status;
      this.headers = headers || {};
    },
    end (body) {
      this.body = body === undefined ? '' : String(body);
    }
  };
}

function request (fiftyOneDid, result = 'sealed', challenge = 'chal') {
  return new URL('http://localhost/redeem?51did=' + fiftyOneDid +
    '&result=' + encodeURIComponent(result) + '&challenge=' + challenge);
}

function clientAnswering ({ signature = true, redeem }) {
  return {
    calls: [],
    async verifySignature (fodId) {
      this.calls.push(['verifySignature', fodId]);
      return signature;
    },
    async redeem (fodId, result, challenge) {
      this.calls.push(['redeem', fodId, result, challenge]);
      return redeem(fodId, result, challenge);
    }
  };
}

describe('creator context example /redeem route', () => {
  test('answers in the cloud shape with serverSignature added', async () => {
    const cloudBody = {
      signature: 'verified',
      context: 'mismatch',
      factors: { transport: 'verified', device: 'mismatch' },
      verifiedAt: '2026-08-07T09:15:32Z',
      secondsSinceVerified: 2
    };
    const client = clientAnswering({
      redeem: () => RedeemResult.fromResponse(200, JSON.stringify(cloudBody))
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);

    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(response.body)).toEqual(
      Object.assign({ serverSignature: 'verified' }, cloudBody));

    // Parsed from the URL-safe form, verified, then redeemed with what the
    // page sent.
    expect(client.calls[0][0]).toBe('verifySignature');
    expect(client.calls[0][1]).toBeInstanceOf(FodId);
    expect(client.calls[0][1].asBase64()).toBe(fod.asBase64());
    expect(client.calls[1]).toEqual(['redeem', client.calls[0][1], 'sealed', 'chal']);
  });

  test('reports an invalid offline signature as serverSignature invalid', async () => {
    const client = clientAnswering({
      signature: false,
      redeem: () => RedeemResult.fromResponse(200, JSON.stringify({
        signature: 'verified',
        context: 'verified',
        verifiedAt: '2026-08-07T09:15:32Z',
        secondsSinceVerified: 1
      }))
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    const body = JSON.parse(response.body);
    expect(body.serverSignature).toBe('invalid');
    expect(body.signature).toBe('verified');
  });

  test('relays a 503 unconfirmed result with its status', async () => {
    const client = clientAnswering({
      redeem: () => RedeemResult.fromResponse(503, '{"context":"unconfirmed"}')
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({
      context: 'unconfirmed', serverSignature: 'verified'
    });
  });

  test('a 51did that does not parse answers 400 with errors', async () => {
    const client = clientAnswering({ redeem: () => { throw new Error('unreached'); } });
    const response = fakeResponse();
    await redeemRoute(client)(request('not-a-51did'), response);
    expect(response.status).toBe(400);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(response.body).errors).toHaveLength(1);
    expect(client.calls).toHaveLength(0);
  });

  test('a host without the creator context answers 404 with a text body', async () => {
    const client = clientAnswering({
      redeem: () => { throw new DidNotSupportedError('no', 404, 'Not found'); }
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(404);
    expect(response.headers['Content-Type']).toBe('text/plain');
    expect(response.body).toBe('Not found');
  });

  test('a cloud 400 is relayed with its JSON body', async () => {
    const body = '{"errors":["bad"]}';
    const client = clientAnswering({
      redeem: () => { throw new DidArgumentError('bad', 400, body); }
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(400);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.body).toBe(body);
  });

  test('another cloud status is relayed as text', async () => {
    const client = clientAnswering({
      redeem: () => { throw new DidClientError('boom', 500, 'Server Error'); }
    });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(500);
    expect(response.headers['Content-Type']).toBe('text/plain');
    expect(response.body).toBe('Server Error');
  });

  test('an unreachable cloud answers 502 with the cause', async () => {
    const failure = new TypeError('fetch failed');
    failure.cause = new Error('ECONNREFUSED');
    const client = clientAnswering({ redeem: () => { throw failure; } });
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'ECONNREFUSED' });
  });

  test('a failure in the offline check is answered, not thrown', async () => {
    const client = {
      async verifySignature () { throw new Error('keys unavailable'); },
      async redeem () { throw new Error('unreached'); }
    };
    const response = fakeResponse();
    await redeemRoute(client)(request(fod.asBase64Url()), response);
    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'keys unavailable' });
  });
});
