/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2023 51 Degrees Mobile Experts Limited, Davidson House,
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

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const cloudEnginePath = path.resolve(__dirname, '../cloudEngine');
const pipelineBuilderPath = path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder');

const CloudEngine = require(cloudEnginePath);
const PipelineBuilder = require(pipelineBuilderPath);

// Invalid resource key
const testResourceKey = 'AAAAAAAAA';

const testCloudRequestEngine = new CloudRequestEngine(
  {
    resourceKey: testResourceKey,
    licenseKey: undefined,
    baseURL: 'https://cloud.51degrees.com/api/v4/'
  });

const testCloudEngine = new CloudEngine();

// Create flow data for testing
const pipeline = new PipelineBuilder()
  .add(testCloudRequestEngine)
  .add(testCloudEngine)
  .build();

// Override the log() function behaviour so that
// it does not through an emitter event
Reflect.set(pipeline, 'log', function () {});
const flowData = pipeline.createFlowData();

// Check that if an invalid resource key is used, a correct error
// message will be returned and stored in flowData.errors
test('missing property service - invalid resource key', done => {
  pipeline.suppressProcessExceptions = true;
  flowData.process().then(function () {
    let errorFound = false;
    const error = flowData.errors.CloudEngineBase[0];
    errorFound = error.message.includes(testResourceKey) &&
    error.message.includes('is not a valid Resource Key');
    expect(errorFound).toBe(true);

    done();
  });
});
