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

const util = require('util');
const path = require('path');

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const cloudEnginePath = path.resolve(__dirname, '../cloudEngine');
const pipelineBuilderPath = path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder');
const aspectDataDictionaryPath = path.resolve(__dirname, '../../fiftyone.pipeline.engines/aspectDataDictionary');
const coreErrorMessagesPath = path.resolve(__dirname, '../../fiftyone.pipeline.core/errorMessages');
const engineErrorMessagesPath = path.resolve(__dirname, '../../fiftyone.pipeline.engines/errorMessages');

const CloudEngine = require(cloudEnginePath);
const PipelineBuilder = require(pipelineBuilderPath);
const AspectDataDictionary = require(aspectDataDictionaryPath);
const coreErrorMessages = require(coreErrorMessagesPath);
const engineErrorMessages = require(engineErrorMessagesPath);

// Test cloud engine class
class TestCloudEngine extends CloudEngine {
  constructor (dataKey, properties, contents) {
    super();
    this.dataKey = dataKey;
    this.properties = properties;
    this.registrationCallbacks = [];
    this.contents = contents;
  }

  ready () {
    return new Promise(function (resolve) {
      resolve();
    });
  }

  processInternal (flowData) {
    const engine = this;

    return engine.ready().then(function () {
      const data = new AspectDataDictionary(
        { flowElement: engine, contents: engine.contents }
      );

      flowData.setElementData(data);
    });
  }
}

// Create different cloud engines for testing different scenario
const testEngineNoProperties = new TestCloudEngine('testEngineNoProperties',
  undefined, {});
const testEngineMissingContents = new TestCloudEngine(
  'testEngineMissingContents',
  { one: { meta: { type: 'int' } }, two: { meta: { type: 'int' } } },
  { one: 1 });
const testEngine = new TestCloudEngine('testEngine',
  { one: { meta: { type: 'int' } }, two: { meta: { type: 'int' } } },
  { one: 1, two: 2 });

// Create flow data for testing
const flowData = new PipelineBuilder()
  .add(testEngineNoProperties)
  .add(testEngineMissingContents)
  .add(testEngine)
  .build()
  .createFlowData();

// Check that in the scenario where attempting to access a property value under
// a cloud engine, the resource key does not have any properties under that
// product (e.g. the key has no location properties and the caller is trying
// to get the value of location.country), a correct error message is returned.
test('missing property service - no properties for resource key', done => {
  flowData.process().then(function () {
    try {
      flowData.get('testEngineNoProperties').get('one');
    } catch (e) {
      expect(e.indexOf(
        util.format(coreErrorMessages.genericMissingProperties, 'one') +
        ' in data for element "testEngineNoProperties".' +
        util.format(engineErrorMessages.cloudNoPropertiesAccess,
          'testEngineNoProperties')) !== -1)
        .toBe(true);
    }

    done();
  });
});

// Check that in the scenario where attempting to access a property value
// under a cloud engine, the resource key does not include the requested
// property, but does include other properties under the same engine, a
// correct error message is returned.
test('missing property service - property not included in resource key', done => {
  flowData.process().then(function () {
    try {
      flowData.get('testEngine').get('three');
    } catch (e) {
      expect(e.indexOf(
        util.format(coreErrorMessages.genericMissingProperties, 'three') +
        ' in data for element "testEngine".' +
        util.format(engineErrorMessages.cloudNoPropertyAccess,
          'testEngine', 'one, two')) !== -1)
        .toBe(true);
    }

    done();
  });
});

// Check that in the scenario where attempting to access a property value
// under a cloud engine and neither of the above scenarios is correct, a
// correct error message is returned.
test('missing property service - unknown reason', done => {
  flowData.process().then(function () {
    try {
      flowData.get('testEngineMissingContents').get('two');
    } catch (e) {
      expect(e.indexOf(
        util.format(coreErrorMessages.genericMissingProperties, 'two') +
        ' in data for element "testEngineMissingContents".' +
        util.format(engineErrorMessages.cloudReasonUnknown)) !== -1).toBe(true);
    }

    done();
  });
});
