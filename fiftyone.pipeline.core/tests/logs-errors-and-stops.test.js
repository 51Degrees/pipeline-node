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
const errorMessages = require(path.resolve(__dirname, '..', 'errorMessages'));
const setup = require(path.resolve(__dirname, 'coreTestSetup.js'));
const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));

const syncPipeline = new PipelineBuilder()
  .add(setup.async)
  .add(setup.sync)
  .add(setup.error)
  .add(setup.stop)
  .add(setup.neverRun)
  .build();

const syncFlowData = syncPipeline.createFlowData();
test('error data is populated', done => {
  syncPipeline.suppressProcessExceptions = true;
  syncFlowData.process().then(function () {
    expect(syncFlowData.errors.error).toBe('Something went wrong');

    done();
  });
});

let log;

syncPipeline.on('error', function (error) {
  console.log(error);
  log = error;
});

test('logging', done => {
  syncPipeline.suppressProcessExceptions = true;
  syncFlowData.process().then(function () {
    expect(log).toBe("Error occurred during processing of error. 'Something went wrong'");

    done();
  });
});

test("Don't Suppress Exception", done => {
  syncFlowData.process().then(function () {
    done();
  }).catch((e) => {
    // When an error occurs, check that the expected values are populated.
    expect(e.indexOf('Something went wrong') !== -1).toBe(true);
  });
});

test('stop flag works', done => {
  syncFlowData.process().then(function () {
    try {
      syncFlowData.get('neverRun');
    } catch (e) {
      expect(e.indexOf(util.format(errorMessages.noElementData,
        'neverRun', 'async, sync')) !== -1).toBe(true);
    }
    done();
  });
});
