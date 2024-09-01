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

const util = require('util');
const errorMessages = require('../errorMessages');
const setup = require(path.resolve(__dirname, 'coreTestSetup.js'));
const PipelineBuilder = require('../pipelineBuilder');

const syncPipeline = new PipelineBuilder()
  .add(setup.async)
  .add(setup.sync)
  .build();

const syncFlowData = syncPipeline.createFlowData();

setup.sync.properties = {
  integer: {
    type: 'int',
    extra: 'test'
  },
  boolean: {
    type: 'bool'
  }
};

const newPropertyFlowData = syncPipeline.createFlowData();

/**
 * Check that the 'updateProperties' function on flowElement is
 * working as expected.
 * The property list is updated with a new property. We then
 * process the element and verify the new property's value.
 */
test('Update property list on flowElement', done => {
  setup.sync.updateProperties().then(function () {
    newPropertyFlowData.process().then(function (flowData) {
      expect(flowData.getWhere('extra', 'test').integer).toBe(5);

      done();
    });
  });
});

/**
 * Check that the 'get' functions on flowData and elementData
 * return the expected values.
 */
test('get', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.get('sync').get('integer')).toBe(5);

    done();
  });
});

/**
 * Check that the 'get' functions on flowData using an invalid
 * data key will result in an exception with correct message
 */
test('get invalid data key', done => {
  syncFlowData.process().then(function () {
    try {
      syncFlowData.invalid; // eslint-disable-line
    } catch (e) {
      expect(e.indexOf(
        util.format(
          errorMessages.noElementData,
          'invalid', 'async, sync, jsonbundler, javascriptbuilder, set-headers')) !== -1)
        .toBe(true);

      done();
    }
  });
});

/**
 * Check that the proxy on flowData can be used to access
 * element data instances using a 'fake' property in the same
 * way as the 'get' function used above.
 */
test('get from flowElement property', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.sync.get('integer')).toBe(5);

    done();
  });
});

/**
 * Check that the proxy on elementData can be used to access
 * values using a 'fake' property in the same way as the
 * 'get' function used above.
 */
test('get from flowElement property as property', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.sync.integer).toBe(5);

    done();
  });
});

/**
 * Verify that automatic formatting of an elementData instance
 * does not cause an error.
 * This has caused a problem in the past due to the proxy getter on
 * elementData, which makes it appear that there are 'properties'
 * on the class even though they're not really there.
 * The formatter passes unexpected objects and strings as keys
 * to the proxy function, which can cause errors if not handled
 * correctly.
 */
test('get for formatting', done => {
  syncFlowData.process().then(function () {
    expect(() => {
      return syncFlowData.sync;
    }).not.toThrow();

    done();
  });
});

/**
 * Check that the 'getFromElement' function can be used to
 * access element data instances.
 */
test('getFromElement', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.getFromElement(setup.sync).get('integer')).toBe(5);

    done();
  });
});

/**
 * Check that we can use a for loop to iterate through the
 * properties on an elementData instance.
 */
test('for of', done => {
  syncFlowData.process().then(function () {
    const keys = [];
    for (const key of syncFlowData.sync) {
      keys.push(key);
    }
    expect(JSON.stringify(keys)).toBe(JSON.stringify(['integer', 'boolean']));
    done();
  });
});

/**
 * Check that the getWhere function can be used to retrieve
 * properties matching a supplied filter.
 */
test('getWhere', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.getWhere('type', 'int').integer).toBe(5);

    done();
  });
});

/**
 * Check that the getWhere function can be used to retrieve
 * properties matching a supplied function filter.
 */
test('getWhere function version', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.getWhere('type', function (value) {
      return value === 'int';
    }).integer).toBe(5);

    done();
  });
});

/**
 * Verify that engines run one after the other by default.
 */
test('engines run in series', done => {
  syncFlowData.process().then(function () {
    expect(syncFlowData.get('sync').get('boolean')).toBe(true);

    done();
  });
});

const asyncPipeline = new PipelineBuilder()
  .addParallel([setup.sync, setup.async]).build();
const asyncFlowData = asyncPipeline.createFlowData();
/**
 * Verify that engines configured to run in parallel will do so.
 */
test('engines run in parallel', done => {
  asyncFlowData.process().then(function () {
    expect(asyncFlowData.get('sync').get('boolean')).toBe(false);

    done();
  });
});

const configPipeline = new PipelineBuilder()
  .buildFromConfigurationFile(path.resolve(__dirname, 'config.json'));
const configPipelineFlowData = configPipeline.createFlowData();

/**
 * Verify that the 'buildFromConfigurationFile' function will
 * pull values from the supplied json file and supply them to
 * flow elements as expected.
 */
test('build from config', done => {
  configPipelineFlowData.process().then(function () {
    expect(configPipelineFlowData.get('configTest')
      .get('built')).toBe('hello_world');
    expect(configPipeline.getElement('sequence')).not.toBe(undefined);
    expect(configPipeline.getElement('jsonbundler')).not.toBe(undefined);
    expect(configPipeline.getElement('javascriptbuilder')).not.toBe(undefined);
    expect(configPipeline.getElement('set-headers')).not.toBe(undefined);

    done();
  });
});

/**
 * Verify the behaviour of AspectPropertyValue instances.
 */
test('aspectPropertyValue', done => {
  const apvPipeline = new PipelineBuilder().add(setup.apvTest).build();

  const flowData = apvPipeline.createFlowData();

  flowData.process().then(function () {
    // Verify behaviour where the APV has a value.
    expect(flowData.apv.get('yes').hasValue).toBe(true);
    expect(flowData.apv.get('yes').value).toBe('success');

    // Verify behaviour where the APV does not have a value.
    expect(flowData.apv.get('no').hasValue).toBe(false);
    expect(expect(flowData.apv.no.noValueMessage).toBe('Value missing'));

    const error = ''; // eslint-disable-line

    // Trying to access the value of an APV that does not have a
    // value should throw an error.
    expect(() => { return flowData.apv.no.value; }).toThrow();
    expect(() => { return flowData.apv.no.value; }).toThrowError('Value missing');

    done();
  });
});
