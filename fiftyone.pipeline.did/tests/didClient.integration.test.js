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
  FodId, DidClient, ContextResult, DidNotSupportedError, Usage, IdType
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
    expect(fodId.date).toBeGreaterThan(0);
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
  // The versioned Model Terms for Marketing document a marketing 51Did is
  // created under. Written out here rather than read from the package,
  // because a test that asked the package what it expects would agree with
  // itself whatever the package said. The literal is what a receiver has to
  // be able to fetch.
  const MODEL_TERMS_FOR_MARKETING_2 = 'https://m4ow.uk/mtm/2.txt';

  // Each id.usage the service offers, the usage this package must answer
  // with, and the terms the identifier must carry. A non-marketing
  // identifier may not reach a demand source at all, so there is nothing
  // for a receiver to agree to and it states no terms.
  const usages = [
    ['non-marketing', Usage.NON_MARKETING, null],
    ['standard', Usage.STANDARD, MODEL_TERMS_FOR_MARKETING_2],
    ['personalized', Usage.PERSONALIZED, MODEL_TERMS_FOR_MARKETING_2]
  ];

  // IAB TCF v2 consent strings, and the usage the service must derive from
  // each without the caller stating one. The first grants all twelve
  // purposes, the second the Appendix 1 standard set of 1, 2, 7, 8 and 11.
  // These are the strings the cloud's own IabTcfElement tests use, repeated
  // here rather than shared, for the same reason as the address above.
  const consentStrings = [
    ['AAAAAAAAAAAAAAAAAAAAAAAAAP_w', Usage.PERSONALIZED],
    ['AAAAAAAAAAAAAAAAAAAAAAAAAMMg', Usage.STANDARD]
  ];

  // Asks the json endpoint for a 51Did with the given query fragment and
  // returns every identifier it answered with. An empty array means the
  // resource key is not entitled to that usage, which is reported by the
  // caller rather than failed.
  const identifiersFor = async (fragment) => {
    const url = client.endpoint + 'json?resource=' +
      encodeURIComponent(resourceKey) + '&' + fragment +
      '&values=FODiD.IdProbGlobal&values=FODiD.IdProbLic';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'fiftyone.pipeline.did tests' }
    });
    const body = await response.text();
    if (response.status !== 200) {
      throw new Error(`json answered HTTP ${response.status}: ${body}`);
    }
    const fodid = JSON.parse(body).fodid;
    if (!fodid) {
      return [];
    }
    return ['idprobglobal', 'idproblic']
      .map((name) => fodid[name])
      .filter((value) => typeof value === 'string' && value.length > 0)
      .map((value) => FodId.fromBase64(value));
  };

  // Every field the flags byte carries, plus the terms, read through the
  // accessors rather than by masking. The usage values are cumulative,
  // being 001, 011 and 111, so a caller masking the byte for the
  // non-marketing bit reads every marketing identifier as non-marketing.
  // The label travels into the expectation so a failure names which
  // identifier it was.
  const assertAligned = (label, id, usage, terms, indirect) => {
    expect({ label, usage: id.usage }).toEqual({ label, usage });
    expect({ label, indirect: id.usageIsIndirect })
      .toEqual({ label, indirect });
    expect({ label, terms: id.terms }).toEqual({ label, terms });
    expect({ label, type: id.type })
      .toEqual({ label, type: IdType.PROBABILISTIC });
  };

  test('every usage reads back the terms and flags the service wrote',
    async () => {
      let checked = 0;
      for (const [name, usage, terms] of usages) {
        const identifiers = await identifiersFor(
          'id.usage=' + encodeURIComponent(name));
        if (identifiers.length === 0) {
          console.warn(`id.usage=${name}: no identifier returned, so this ` +
            'key is not entitled to that usage.');
          continue;
        }
        identifiers.forEach((id, index) => {
          assertAligned(`${name}[${index}]`, id, usage, terms, false);
        });
        // Only a marketing usage carries a terms address, so only a
        // marketing identifier shows that the service wrote the byte. A
        // non-marketing one states no terms either way, which is the same
        // answer a service predating the Terms release would give.
        if (terms !== null) {
          checked += identifiers.length;
        }
      }
      if (checked === 0) {
        console.warn('NOTHING PROVEN: this resource key returned no ' +
          'marketing 51Did, so no terms address was read. Use a key ' +
          'entitled to the standard or personalized usage.');
      } else {
        console.log(`Terms checked on ${checked} marketing identifier(s).`);
      }
    });

  test('a consent string sets the usage is indirect bit', async () => {
    let proven = 0;
    for (const [tcString, usage] of consentStrings) {
      // No id.usage is sent. A stated usage wins over a consent string, so
      // sending one would leave the bit clear and prove the opposite.
      const identifiers = await identifiersFor(
        'tcstring=' + encodeURIComponent(tcString));
      if (identifiers.length === 0) {
        console.warn(`consent string granting ${usage}: no identifier ` +
          'returned, so this key is not entitled to that marketing usage.');
        continue;
      }
      identifiers.forEach((id, index) => {
        // A consent string granting a marketing usage produces a marketing
        // identifier, so the terms travel with it too.
        assertAligned(`consent/${usage}[${index}]`, id, usage,
          MODEL_TERMS_FOR_MARKETING_2, true);
      });
      proven += identifiers.length;
    }
    if (proven === 0) {
      console.warn('NOTHING PROVEN: this resource key returned no ' +
        'identifier for either consent string, so the usage is indirect ' +
        'bit was never read.');
    } else {
      console.log(`Usage is indirect read on ${proven} identifier(s).`);
    }
  });
});
