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
 * @example usageSharing/usageSharing.js
 *
 * Usage sharing is enabled by default if using some 51Degrees pipeline
 * builders such as the [DeviceDetectionOnPremisePipelineBuilder](https://github.com/51Degrees/device-detection-node/blob/master/fiftyone.devicedetection.onpremise/deviceDetectionOnPremisePipelineBuilder.js)
 * In this example, we show how to specifically add a shareUsage element to a
 * Pipeline using configuration.
 *
 * As with all flow elements, this can also be handled in code, using
 * the constructor parameters. The commented section in the example
 * demonstrates this.
 *
 * The 51d.json file contains all the configuration options.
 * These are all optional, so each can be omitted if the default
 * for that option is sufficient:
 *
 * For details of what each setting does, see the constructor
 * parameters in the reference documentation for the
 * [share usage element](https://51degrees.com/pipeline-node/class_share_usage.html)
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/pipeline-node/tree/master/fiftyone.pipeline.engines.fiftyone/examples/usageSharing/usageSharing.js).
 *
 * Expected output
 * ```
 * Constructing pipeline from configuration file.
 *
 * Pipeline created with share usage element. Evidence processed
 * with this pipeline will now be shared with 51Degrees using the
 * specified configuration.
 * ```
 */

const core = require('fiftyone.pipeline.core');

// Note that this example is designed to be run from within the
// source repository. If this code has been copied to run standalone
// then you'll need to replace the require below with the commented
// out version below it.
const engine51 = require('../..'); // eslint-disable-line
// const engine51 = require("fiftyone.pipeline.engines.fiftyone");

console.log('Constructing pipeline from configuration file.');
console.log();

// Create a new pipeline from the supplied config file.
const pipeline = new core.PipelineBuilder().buildFromConfigurationFile('51d.json'); // eslint-disable-line

// Alternatively, the commented code below shows how to
// configure the ShareUsageElement in code, rather than
// using a configuration file.
// const usageElement = new engine51.ShareUsage({
//  sharePercentage: 0.1,
//  requestedPackageSize: 2000,
// });
// const pipeline = new core.PipelineBuilder().add(usageElement).build();

console.log(`Pipeline created with share usage element. Evidence processed 
with this pipeline will now be periodically shared with 51Degrees using the 
specified configuration.`);
