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

const engines = require('fiftyone.pipeline.engines');
const core = require('fiftyone.pipeline.core');
const Engine = engines.Engine;
const AspectDataDictionary = engines.AspectDataDictionary;
const AspectPropertyValue = core.AspectPropertyValue;
const BasicListEvidenceKeyFilter = core.BasicListEvidenceKeyFilter;

/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('./cloudRequestEngine')} CloudRequestEngine
 */

/**
 * This is a template for all 51Degrees cloud engines.
 * It requires the 51Degrees cloudRequestEngine to be placed in a
 *  pipeline before it. It takes that raw JSON response and
 * parses it to extract the device part.
 * It also uses this data to generate a list of properties and an evidence key filter
 **/
class CloudEngine extends Engine {
  constructor () {
    super(...arguments);

    this.dataKey = 'CloudEngineBase'; // This should be overridden

    this.registrationCallbacks.push((pipeline, flowElement) => {
      this.handlePipelineRegistration(pipeline, flowElement);
    });
  }

  /**
   * Handles the registration of the Cloud Engine in a pipeline.
   * This method is called when a pipeline is registered,
   * and it ensures that the CloudRequestEngine is present in the pipeline.
   *
   * @param {Pipeline} pipeline - The pipeline being registered.
   * @param {FlowElement} flowElement - The flow element associated with the Cloud Engine.
   */
  handlePipelineRegistration (pipeline, flowElement) {
    if (!pipeline.flowElements.cloud) {
      pipeline.log('error', 'No CloudRequestEngine in Pipeline');
    }
    /**
     * @type {CloudRequestEngine}
     */
    this._cloudRequestEngine = pipeline.flowElements.cloud;
    this._flowElement = flowElement;
  }

  /**
   * Updates the Cloud Engine when the CloudRequestEngine is ready.
   * This method fetches properties and evidence keys from the CloudRequestEngine,
   * updating the Cloud Engine accordingly.
   *
   * @param {Function} resolve - Callback to be called on successful completion.
   * @param {Function} reject - Callback to be called if there is an error.
   */
  updateEngineWhenCloudRequestEngineReady (resolve, reject) {
    this._cloudRequestEngine.ready()
      .then(() => {
        this._flowElement.properties = this._cloudRequestEngine.flowElementProperties[this._flowElement.dataKey];
        this.updateProperties();
        this._flowElement.evidenceKeyFilter = new BasicListEvidenceKeyFilter(this._cloudRequestEngine.evidenceKeys);
        resolve(this);
      })
      .catch((error) => {
        this.errors = error;
        reject(this.errors);
      });
  }

  /**
   * Checks if the Cloud Engine is ready.
   * This method returns a Promise that resolves if the CloudRequestEngine is ready,
   * indicating that properties and evidence keys have been successfully fetched.
   *
   * @returns {Promise} A Promise that resolves if the CloudRequestEngine is ready and rejects if there is an error.
   */
  ready () {
    return new Promise((resolve, reject) => this.updateEngineWhenCloudRequestEngineReady(resolve, reject));
  }

  /**
   * Internal process method for all cloud engines
   *
   * @param {FlowData} flowData FlowData to process
   * @returns {Promise<void> | void} Completion promise
   */
  processInternal (flowData) {
    const engine = this;

    return engine.ready().then(function () {
      let cloudData = flowData.get('cloud').get('cloud');

      cloudData = JSON.parse(cloudData);
      const result = {};

      if (cloudData && cloudData[engine.dataKey] === null) {
        flowData.pipeline.log('error', engine.dataKey + ' not populated. ' +
        cloudData[engine.dataKey + 'nullreason'] !== null
          ? cloudData[engine.dataKey + 'nullreason']
          : '\nThis may be because the provided API key is not authorised for ' + engine.dataKey + ' queries.');
      } else {
        // Loop over cloudData.device properties to check if they have a value
        Object.entries(cloudData[engine.dataKey]).forEach(function ([key, value]) {
          result[key] = new AspectPropertyValue();

          if (cloudData[engine.dataKey][key + 'nullreason']) {
            result[key].noValueMessage = cloudData[engine.dataKey][key + 'nullreason'];
          } else {
            result[key].value = value;
          }
        });
      }

      const data = new AspectDataDictionary(
        {
          flowElement: engine,
          contents: result
        });

      flowData.setElementData(data);
    });
  }
}

module.exports = CloudEngine;
