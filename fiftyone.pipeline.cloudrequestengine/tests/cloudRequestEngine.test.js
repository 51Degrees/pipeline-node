/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2025 51 Degrees Mobile Experts Limited, Davidson House,
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

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const sharedValues = require('../sharedValues');
const MockRequestClient = require('./classes/mockRequestClient');
const each = require('jest-each').default;
const util = require('util');
const errorMessages = require('../errorMessages');

// Invalid resource key
const testResourceKey = 'AAAAAAAAAAAA';

const testEnvVarEndPoint = 'https://testhost/';

afterEach(() => { // eslint-disable-line
  // Reset the FOD_CLOUD_API_URL environment variable
  process.env.FOD_CLOUD_API_URL = '';
});

// Check that explicitly setting of the baseURL will take precedence over
// environment variable setting.
test('custom end point - config precedence', done => {
  process.env.FOD_CLOUD_API_URL = testEnvVarEndPoint;
  const testEndPoint = 'testEndPoint/';
  const testCloudRequestEngine = new CloudRequestEngine({
    resourceKey: testResourceKey,
    baseURL: testEndPoint
  });

  expect(testCloudRequestEngine.baseURL).toBe(testEndPoint);

  done();
});

// Check that environment variable setting will take precedence over default
// setting
test('custom end point - environment precedence', done => {
  process.env.FOD_CLOUD_API_URL = testEnvVarEndPoint;
  const testCloudRequestEngine = new CloudRequestEngine({
    resourceKey: testResourceKey
  });

  expect(testCloudRequestEngine.baseURL).toBe(testEnvVarEndPoint);

  done();
});

// Check that default setting is used if nothing else is set
test('custom end point - default value', done => {
  const testCloudRequestEngine = new CloudRequestEngine({
    resourceKey: testResourceKey
  });

  expect(testCloudRequestEngine.baseURL).toBe(sharedValues.baseURLDefault);

  done();
});

// Check that values from the http response are populated in the
// error object.
test('HTTP data set in error', done => {
  const engine = new CloudRequestEngine({
    resourceKey: testResourceKey
  });

  const builder = new PipelineBuilder();
  const pipeline = builder.add(engine).build();
  const flowData = pipeline.createFlowData();
  const expectedError = '\'' + testResourceKey + '\' is not a valid Resource Key.';

  // When an error occurs, check that the message is logged.
  pipeline.on('error', (e) => {
    expect(e).toBeDefined();
    done();
  });

  flowData.process().then(function () {
    done();
  }).catch((e) => {
    // When an error occurs, check that the expected values are populated.
    expect(e[0].errorMessage.indexOf(expectedError) !== -1).toBe(true);
    expect(e[0].httpStatusCode).toEqual(400);
    expect(e[0].responseHeaders.etag).toBeDefined();
  });
});

/**
 * Test cloud request engine adds correct information to post request
 * following the order of precedence when processing evidence and
 * returns the response in the ElementData. Evidence parameters
 * should be added in descending order of precedence.
 */
each([
  ['query+header (no conflict)', false, 'query.User-Agent=iPhone', 'header.User-Agent=iPhone'],
  ['query+cookie (no conflict)', false, 'query.User-Agent=iPhone', 'cookie.User-Agent=iPhone'],
  ['header+cookie (conflict)', true, 'header.User-Agent=iPhone', 'cookie.User-Agent=iPhone'],
  ['query+a (no conflict)', false, 'query.value=1', 'a.value=1'],
  ['a+b (conflict)', true, 'a.value=1', 'b.value=1'],
  ['e+f (conflict)', true, 'e.value=1', 'f.value=1']
])
  .test('evidence precidence - %s', (name, shouldWarn, evidence1, evidence2) => {
    const evidence1Parts = evidence1.split('=');
    const evidence2Parts = evidence2.split('=');
    const client = new MockRequestClient();

    const engine = new CloudRequestEngine({
      resourceKey: testResourceKey,
      requestClient: client
    });

    const builder = new PipelineBuilder();
    const pipeline = builder.add(engine).build();

    const flowData = pipeline.createFlowData();
    flowData.evidence.add(evidence1Parts[0], evidence1Parts[1]);

    flowData.evidence.add(evidence2Parts[0], evidence2Parts[1]);

    const warnings = [];
    // Store warnings for checking.
    pipeline.on('warn', (w) => { warnings[warnings.length] = w; });
    return flowData.process().then(function (data) {
    // If warn is expected then check for warnings from cloud request
      // engine.
      if (shouldWarn === true) {
      // Verify warning is thrown.
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain(
          util.format(errorMessages.evidenceConflict,
            evidence1Parts[0],
            evidence1Parts[1],
            util.format('%s:%s', evidence2Parts[0], evidence2Parts[1])));
      } else {
        expect(warnings.length).toBe(0);
      }
    });
  });

/**
 * Test evidence of specific type is returned from all
 * the evidence passed, if type is not from query, header
 * or cookie then evidences are returned sorted in descensing order
 */
each([
  ['query', { 'query.User-Agent': 'iPhone', 'header.User-Agent': 'iPhone' }, 'query', { 'query.User-Agent': 'iPhone' }],
  ['other', { 'header.User-Agent': 'iPhone', 'a.User-Agent': 'iPhone', 'z.User-Agent': 'iPhone' }, 'other', { 'z.User-Agent': 'iPhone', 'a.User-Agent': 'iPhone' }]
])
  .test('get selected evidence - %s', (name, evidence, type, expectedValue) => {
    const client = new MockRequestClient();
    const engine = new CloudRequestEngine({
      resourceKey: testResourceKey,
      requestClient: client
    });

    const result = engine.getSelectedEvidence(evidence, type);
    expect(result).toStrictEqual(expectedValue);
  });

/**
 * Test Content to send in the POST request is generated as
 * per the precedence rule of The evidence keys. These are
 * added to the evidence in reverse order, if there is conflict then
 * the queryData value is overwritten.
 */
each([
  ['query > header', { 'query.User-Agent': 'query-iPhone', 'header.User-Agent': 'header-iPhone' }, 'query-iPhone'],
  ['header > cookie', { 'header.User-Agent': 'header-iPhone', 'cookie.User-Agent': 'cookie-iPhone' }, 'header-iPhone'],
  ['a > b > z', { 'a.User-Agent': 'a-iPhone', 'b.User-Agent': 'b-iPhone', 'z.User-Agent': 'z-iPhone' }, 'a-iPhone']
])
  .test('get content - %s', (name, evidence, expectedValue) => {
    const client = new MockRequestClient();
    const engine = new CloudRequestEngine({
      resourceKey: testResourceKey,
      requestClient: client
    });

    const pipeline = new PipelineBuilder()
      .add(engine)
      .build();

    const data = pipeline.createFlowData();

    for (const [key, value] of Object.entries(evidence)) {
      data.evidence.add(key, value);
    }

    const result = engine.getContent(data);
    expect(result['User-Agent']).toBe(expectedValue);
  });
