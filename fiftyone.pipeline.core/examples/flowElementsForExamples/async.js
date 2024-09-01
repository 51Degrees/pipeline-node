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

// This async pipeline returns its results after a delay of 500 milliseconds

// Note that this example is designed to be run from within the
// source repository. If this code has been copied to run standalone
// then you'll need to replace the require below with the commented
// out version below it.
const pipelineCore = require('../../');
// let pipelineCore = require("fiftyone.pipeline.core");
const FlowElement = pipelineCore.FlowElement;
const ElementDataDictionary = pipelineCore.ElementDataDictionary;

class Async extends FlowElement {
  constructor () {
    super();

    this.dataKey = 'async';

    this.properties = {
      string: {
        type: 'string'
      }
    };
  }

  processInternal (flowData) {
    const flowElement = this;

    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        const contents = { string: 'hello' };

        const data = new ElementDataDictionary(
          { flowElement, contents }
        );

        flowData.setElementData(data);

        resolve();
      }, 500);
    });
  }
}

module.exports = Async;
