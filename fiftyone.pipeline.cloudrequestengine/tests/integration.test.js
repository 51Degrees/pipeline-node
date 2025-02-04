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

const path = require('path');
const CloudRequestEngine = require('../cloudRequestEngine');
const { fail } = require('assert');

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const cloudEnginePath = path.resolve(__dirname, '..', 'cloudEngine');
const pipelineBuilderPath = path.resolve(__dirname, '..', '..', 'fiftyone.pipeline.core', 'pipelineBuilder');

const CloudEngine = require(cloudEnginePath);
const PipelineBuilder = require(pipelineBuilderPath);

const myResourceKey = process.env.RESOURCE_KEY || '!!YOUR_RESOURCE_KEY!!';

/**
 * Verify that cloud engine returns isMobile property in response.
 * This is an integration test that uses the live cloud service
 * so any problems with that service could affect the result
 * of this test.
 */
test('valid response', done => {
  if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
    fail('You need to create a resource key at ' +
        'https://configure.51degrees.com and paste it into the ' +
        'code, replacing !!YOUR_RESOURCE_KEY!!. Please make sure ' +
        'to include IsMobile property.');
  }
  const cloud = new CloudRequestEngine({
    resourceKey: myResourceKey,
    baseURL: 'http://cloud.51degrees.com/api/v4'
  });
  const engine = new CloudEngine();
  engine.dataKey = 'device';
  const pipeline = new PipelineBuilder()
    .add(cloud)
    .add(engine)
    .build();

  const data = pipeline.createFlowData();
  data.evidence.add('header.user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0');
  data.process().then(data => {
    expect(data.device.ismobile.hasValue).toBe(true);
    done();
  });
});

/**
 * Verify that making POST request with SequenceElement evidence
 * will not return any errors from cloud.
 * This is an integration test that uses the live cloud service
 * so any problems with that service could affect the result
 * of this test.
 */
test('post with sequence evidence', done => {
  if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
    fail('You need to create a resource key at ' +
        'https://configure.51degrees.com and paste it into the ' +
        'code, replacing !!YOUR_RESOURCE_KEY!!. Please make sure ' +
        'to include IsMobile property.');
  }

  const cloud = new CloudRequestEngine({ resourceKey: myResourceKey });
  const engine = new CloudEngine();
  engine.dataKey = 'device';
  const pipeline = new PipelineBuilder()
    .add(cloud)
    .add(engine)
    .build();

  const data = pipeline.createFlowData();
  data.evidence.add('query.session-id', '8b5461ac-68fc-4b18-a660-7bd463b2537a');
  data.evidence.add('query.sequence', 1);
  data.process().then(result => {
    expect(Object.entries(result.errors).length).toBe(0);
    done();
  });
});
