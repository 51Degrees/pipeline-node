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

// Live tests against the cloud, run only when a resource key is set. The
// aligned _51DEGREES_RESOURCE_KEY environment variable is checked first,
// then the legacy RESOURCE_KEY variable, and without either the whole
// file is skipped rather than failed. The endpoint follows
// FOD_CLOUD_API_URL as the client does.

const {
  FodId, DidClient, ContextResult, DidNotSupportedError
} = require('../index');

const resourceKey = process.env._51DEGREES_RESOURCE_KEY ||
  process.env.RESOURCE_KEY || '';
const licenceKey = process.env._51DEGREES_LICENSE_KEY ||
  process.env.LICENSE_KEY || '';

const live = resourceKey ? describe : describe.skip;

live('DidClient against the cloud', () => {
  jest.setTimeout(30000);

  let client;
  let fodId;

  beforeAll(async () => {
    client = new DidClient({ resourceKey, licenceKey });
    // Created through the json endpoint, as a page or the cloud request
    // engine would, asking for the global probabilistic identifier.
    const url = client.endpoint + 'json?resource=' +
      encodeURIComponent(resourceKey) +
      '&id.usage=non-marketing&values=FODiD.IdProbGlobal';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'fiftyone.pipeline.did tests' }
    });
    const body = await response.text();
    if (response.status !== 200) {
      throw new Error(`json answered HTTP ${response.status}: ${body}`);
    }
    const created = JSON.parse(body).fodid.idprobglobal;
    if (typeof created !== 'string') {
      throw new Error('json answered without idprobglobal: ' + body);
    }
    fodId = FodId.fromBase64(created);
  });

  test('parses, verifies offline and verifies through the cloud', async () => {
    expect(fodId.version).toBe(3);
    expect(fodId.dateMinutes).toBeGreaterThan(0);
    const key = await client.publicKeyFor(fodId);
    expect(key).not.toBeNull();
    expect(key.publicKey).toMatch(/BEGIN PUBLIC KEY/);
    await expect(client.verifySignature(fodId)).resolves.toBe(true);
    await expect(client.verify(fodId)).resolves.toBe(true);
    // The URL-safe form is accepted by the cloud too.
    await expect(client.verify(fodId.asBase64Url())).resolves.toBe(true);
  });

  test('redeem with a garbage result answers unreadable with 200', async () => {
    let result;
    try {
      result = await client.redeem(fodId, 'not-a-sealed-result', 'challenge');
    } catch (error) {
      if (error instanceof DidNotSupportedError) {
        // A host without the creator context. Reported rather than failed.
        console.warn('Skipped: the host at ' + client.endpoint +
          ' does not offer the creator context.');
        return;
      }
      throw error;
    }
    expect(result.statusCode).toBe(200);
    expect(result.context).toBe(ContextResult.UNREADABLE);
  });
});
