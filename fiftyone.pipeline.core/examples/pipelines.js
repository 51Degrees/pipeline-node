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

/**
 * @example pipelines.js
 *
 * This example demonstrates syncronous and asyncronous pipelines
 * with multiple flowElements and other core features of the 51Degrees pipeline
 *
 */

// Note that this example is designed to be run from within the
// source repository. If this code has been copied to run standalone
// then you'll need to replace the require below with the commented
// out version below it.
const pipelineCore = require('../');
// let pipelineCore = require("fiftyone.pipeline.core");

const PipelineBuilder = pipelineCore.PipelineBuilder;

// Load in some example flowElements

// A flowElement that runs asyncronously with a sitetimeout task

const async = new (require('./flowElementsForExamples/async'))();

// A flowElement that runs syncronously which loads a different
// result if the async one has already finished processing

const sync = new (require('./flowElementsForExamples/sync'))();

// A flowElement that stops processing

const stop = new (require('./flowElementsForExamples/stop'))();

// A dummy flowElement to show that subsequent flowElements
// don't process once the flowData has been stopped
const neverRun = new (require('./flowElementsForExamples/neverRun'))();

// Build a pipeline that runs all its elements in series

const syncPipeline = new PipelineBuilder()
  .add(async)
  .add(sync)
  .add(stop)
  .add(neverRun)
  .build();

// Create flowData
const syncFlowData = syncPipeline.createFlowData();

// Various ways of setting evidence

syncFlowData.evidence.add('header.user_agent', 'test');
syncFlowData.evidence.add('header.other', 'no');
syncFlowData.evidence.addObject({ test: 'testing' });

// Get all, or some evidence
syncFlowData.evidence.get('test');
syncFlowData.evidence.getAll();

// Process the flowData (this returns a promise)
syncFlowData.process().then(function () {
  console.log(syncFlowData.sync.integer);
  console.log(syncFlowData.getFromElement(sync).integer);
  console.log(syncFlowData.getWhere('type', 'int'));
  console.log(syncFlowData.getWhere('type', (type) => type === 'int'));
});

syncPipeline.on('error', console.error);

// This is a pipeline that runs the flowElements in parallel
// (the sync element will not wait for the async one to finish)

const asyncPipeline = new PipelineBuilder()
  .addParallel([async, sync]);

asyncPipeline.build();
