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

const EvidenceKeyFilterBase = require('./evidenceKeyFilter');

/**
 * @typedef {import('./flowData')} FlowData
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./evidenceKeyFilter')} EvidenceKeyFilter
 */

/**
 * A FlowElement is placed inside a pipeline
 * It receives Evidence via a FlowData object
 * It uses this to optionally create ElementData on the Flowdata
 * It has a unique dataKey which is used to extract data from the FlowData
 * Any errors in processing are caught in the FlowData's errors object
 **/
class FlowElement {
  /**
   * Constructor for flowElement class
   *
   * @param {object} options options for the FlowElement
   * @param {string} options.dataKey the dataKey the flowElement's
   * elementData will be stored under
   * @param {Function} options.processInternal callback to act on flowData
   * @param {object} options.properties list of properties including metadata
   * @param {EvidenceKeyFilter} options.evidenceKeyFilter an instance of
   * an EvidenceKeyFilter to filter evidence added to the Pipeline
   */
  constructor ({
    processInternal,
    dataKey,
    properties = {},
    evidenceKeyFilter
  } = {}) {
    this.dataKey = dataKey;

    if (processInternal) {
      this.processInternal = processInternal;
    }

    this.properties = properties;

    if (evidenceKeyFilter) {
      this.evidenceKeyFilter = evidenceKeyFilter;
    } else {
      this.evidenceKeyFilter = new EvidenceKeyFilterBase();
    }

    /**
     * @type {Function[]}
     */
    this.registrationCallbacks = [];

    // List of pipelines the flowElement has been added to
    /**
     * @type {Pipeline[]}
     */
    this.pipelines = [];
  }

  /**
   * Internal function to be called when a FlowElement is added
   * to pipeline, runs through any registrationCallbacks on the FlowElement
   *
   * @param {Pipeline} pipeline the Pipeline the FlowElement is registered with
   * @param {FlowElement} flowElement The FlowElement the
   * registration callback is called on
   */
  onRegistration (pipeline, flowElement) {
    this.registrationCallbacks.forEach(function (registrationCallback) {
      registrationCallback(pipeline, flowElement);
    });
  }

  /**
   * Function called to check if a FlowElement is ready
   * Used when there are asynchronous initialisation steps
   *
   * @returns {Promise} returns Promise
   * */
  ready () {
    return Promise.resolve(this);
  }

  /**
   * Internal process function for a particular flowElement called
   * (via the flowElement.process() method) when flowData generated
   * by a pipleline is processsed. Overriden by instances of this base class
   *
   * @param {FlowData} flowData FlowData being processed
   * @returns {*} result of processing
   */
  processInternal (flowData) {
    return true;
  }

  /**
   * To allow actions to take place before and after a
   * FlowElement's processInternal function runs, a process
   * wrapper is run first
   *
   * @param {FlowData} flowData FlowData being processed
   * @returns {Promise} FlowData after processing
   */
  process (flowData) {
    return Promise.resolve(this.processInternal(flowData));
  }

  /**
   * Call this function to update the properties meta database
   * in all the pipelines this flowElement has been added to
   *
   * @returns {Promise} notification of complete updates
   */
  updateProperties () {
    const flowElement = this;

    const updates = [];

    this.pipelines.forEach(function (pipeline) {
      updates.push(pipeline.updatePropertyDataBaseForElement(flowElement));
    });

    return Promise.all(updates);
  }

  /**
   * Get a flowElement's properties. By default returns a
   * promise wrapped version of the object's properties list
   * Can return standard value or promise
   *
   * @returns {object} dictionary of properties
   */
  getProperties () {
    return this.properties;
  }

  /**
   * Internal log
   *
   * @param {string} type log type
   * @param {*} message message to log
   */
  _log (type, message) {
    if (this.pipelines) {
      this.pipelines.forEach(pipeline => {
        pipeline.log(type, message);
      });
    }
  }
}

module.exports = FlowElement;
