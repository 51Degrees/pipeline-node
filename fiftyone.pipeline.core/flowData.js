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
const errorMessages = require('./errorMessages');
const Evidence = require('./evidence');

/**
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./elementData')} ElementData
 */

/**
 * FlowData is created by a specific pipeline
 * It collects evidence set by the user
 * It passes evidence to flowElements in the pipeline
 * These elements can return ElementData or populate an errors object
 */
class FlowData {
  /**
   * constructor for flowData created by a pipeline.
   * Called by a pipeline's createFlowData() method
   *
   * @param {Pipeline} pipeline the pipeline to add the FlowData to
   */
  constructor (pipeline) {
    this.pipeline = pipeline;

    // All evidence added to a flowData is stored in a special
    // collection class for easy retrieval and searching
    this.evidence = new Evidence(this);

    // Errors object, keyed by flowElement that caused the error
    this.errors = {};

    // Stop flag, if the flowData is stopped, no further
    // flowElements are processed
    this.stopped = false;

    // Store of data by flowElement dataKey
    this.data = {};

    return new Proxy(this, {
      get: (data, key) => {
        // This proxy can end up getting called by anything that tries
        // to access methods & properties on the object.
        // In future, this mechanism will be superseded by a less problematic
        // approach. For now, we work around this by only passing string keys
        // to the data getters.
        if (typeof key === 'string' || key === Symbol.iterator) {
          try {
            let value = data[key];
            if (typeof value === 'undefined') {
              value = data.get(key);
            }
            return value;
          } catch (e) {
            // If the key was 'then' and an error was thrown then we
            // can ignore it. Otherwise, throw the error back up the stack.
            // The key can be 'then' when using 'Promise.then(flowData)'.
            // if (key !== 'then' && key !== 'stopped') {
            if (key !== 'then') {
              throw e;
            }
          }
        }
      }
    });
  }

  /**
   * Get back an object that lists all evidence that will be
   * used by any flowElements in the flowData's parent pipeline
   *
   * @returns {object} Evidence that is requested by flowElements
   */
  getEvidenceDataKey () {
    // Get all evidence in flowData
    const evidence = this.evidence.getAll();

    // Evidence that is requested by flowElements
    let keep = {};

    Object.keys(this.pipeline.flowElements).forEach(function (key) {
      const flowElement = this.pipeline.flowElements[key];
      // merge in the filtered evidence for the flowElement
      keep = Object.assign(
        keep,
        flowElement.evidenceKeyfilter.filterEvidence(evidence)
      );
    });

    return keep;
  }

  /**
   * Stop a flowData from processing any further flowElements
   */
  stop () {
    this.pipeline.log('info', 'FlowData stopped');

    this.stopped = true;
  }

  /**
   * Set an error on the flowData (usually triggered by
   * something going wrong in a flowElement's process function)
   *
   * @param {*} error the error to throw
   * @param {FlowElement} flowElement the FlowElement the error is thrown on
   */
  setError (error, flowElement) {
    let errorKey;

    if (flowElement && flowElement.dataKey) {
      errorKey = flowElement.dataKey;
    } else {
      // catch error when flowElement datakey isn't available
      errorKey = 'other';
    }

    this.errors[errorKey] = error;

    let logMessage = 'Error occurred during processing';

    if (errorKey !== undefined) {
      logMessage = logMessage + ' of ' + errorKey + ". '" + error + "'";
    }

    this.pipeline.log('error', logMessage);
  }

  /**
   * Processes the flowData (running the process methods on all connected)
   *
   * @returns {Promise} result of processing
   */
  process () {
    this.pipeline.log('info', 'Pipeline processing started');

    return this.pipeline.processMethod(this);
  }

  /**
   * Add to the flowData object with a class derived from ElementData
   *
   * @param {ElementData} data instance of ElementData to
   * set for the FlowElement's datakey
   * @returns {FlowData} the FlowData object
   */
  setElementData (data) {
    this.data[data.flowElement.dataKey] = data;

    return this;
  }

  /**
   * Get ElementData by a flowElement's data key
   *
   * @param {string} flowElementDataKey the datakey of a FlowElement
   * @returns {ElementData} data from the FlowElement
   */
  get (flowElementDataKey) {
    this.pipeline.log('debug', 'Getting flowElement ' + flowElementDataKey);

    const elementData = this.data[flowElementDataKey];
    if (typeof elementData === 'undefined') {
      const message = util.format(errorMessages.noElementData,
        flowElementDataKey, Object.keys(this.data).join(', '));
      throw message;
    }
    return elementData;
  }

  /**
   * get ElementData by a FlowElement object
   *
   * @param {FlowElement} flowElement The FlowElement to fetch data for
   * @returns {ElementData} data from the FlowElement
   */
  getFromElement (flowElement) {
    const key = flowElement.dataKey;

    return this.get(key);
  }

  /**
   * get an object ({key:value} store) of elementData
   * based on a metadata key and value, alternatively
   * pass in a filtering function to manually filter available propeties
   *
   * @param {string} metaKey a metakey such as "category"
   * @param {string|Function} metaValueorFuncton value or a filter
   * function which receives the value of the metaKey and returns a boolean
   * @returns {object} key value pair of matching properties and values
   */
  getWhere (metaKey, metaValueorFuncton) {
    const flowData = this;

    const propertyList = this.pipeline.propertyDatabase;

    let filteredProperties = {};

    if (propertyList[metaKey]) {
      if (typeof metaValueorFuncton !== 'function') {
        metaValueorFuncton = metaValueorFuncton.toLowerCase();

        if (propertyList[metaKey][metaValueorFuncton]) {
          filteredProperties = propertyList[metaKey][metaValueorFuncton];
        }
      } else {
        Object.keys(propertyList[metaKey]).forEach(function (value) {
          if (metaValueorFuncton(value)) {
            Object.assign(filteredProperties, propertyList[metaKey][value]);
          }
        });
      }
    }

    const output = {};

    Object.keys(filteredProperties).forEach(function (propertyName) {
      const property = filteredProperties[propertyName];
      const flowElementKey = property.flowElementKey;

      try {
        output[propertyName] = flowData.get(flowElementKey).get(propertyName);
      } catch (e) {
        // Ignore errors when fetching a property
        // as getWhere would often crash to an exception
        // if properties are not available, they should be excluded
      }
    });

    return output;
  }
}

module.exports = FlowData;
