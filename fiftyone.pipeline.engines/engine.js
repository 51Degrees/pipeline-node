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

const FlowElement = require('fiftyone.pipeline.core').FlowElement;

const DataFileUpdateService = require('./dataFileUpdateService');

/**
 * @typedef {import('./dataFile')} DataFile
 * @typedef {import('./dataKeyedCache')} DataKeyedCache
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

/**
 * An Engine is an extension of a FlowElement which adds
 * options such as restricting to a subset of properties
 * and a cache and the ability to load property data
 * from a datafile of the DataFile class
 */
class Engine extends FlowElement {
  /**
   * Constructor for an Engine
   *
   * @param {object} options options for the engine
   * @param {DataFile} options.dataFile an optional datafile
   * to add to the engine
   * @param {DataKeyedCache} options.cache instance of a DataKeyedCache
   * @param {Array} options.restrictedProperties specific list
   * of properties to fetch elementData for
   */
  constructor (
    {
      cache, restrictedProperties, dataFile
    } = {}
  ) {
    super(...arguments);

    if (dataFile) {
      this.registerDataFile(dataFile);
    }

    if (cache) {
      this.cache = cache;
    }

    if (restrictedProperties) {
      this.restrictedProperties = restrictedProperties;
    }
  }

  /**
   * Checks cache and returns cached result if found.
   *
   * @param {FlowData} flowData checks if a FlowData's evidence
   * is already in the cache and processing can be bypassed
   * @returns {boolean} whether in cache
   */
  inCache (flowData) {
    let keys = this.evidenceKeyFilter
      .filterEvidence(flowData.evidence.getAll());

    keys = JSON.stringify(keys);

    const cached = this.cache.get(keys);

    if (cached) {
      flowData.setElementData(cached);

      return true;
    } else {
      return false;
    }
  }

  /**
   * An engine's process function checks cache for an item
   * (calling inCache)
   * If found it returns the cached object
   * If not found it runs the standard processInternal function
   * and adds it to the cache (if a cache is present)
   *
   * @param {FlowData} flowData FlowData to process
   * @returns {Promise<true|void>} result of processing
   */
  process (flowData) {
    const engine = this;

    if (this.cache) {
      if (this.inCache(flowData)) {
        return Promise.resolve(true);
      }
    }

    return Promise.resolve(this.processInternal(flowData)).then(function () {
      if (engine.cache) {
        let keys = engine.evidenceKeyFilter
          .filterEvidence(flowData.evidence.getAll());

        keys = JSON.stringify(keys);

        engine.cache.put(keys, flowData.get(engine.dataKey));
      }
    });
  }

  /**
   * Callback which runs when an attached DataFile is updated
   * Needs to be overriden by a specific engine to do anything
   *
   * @returns {void}
   */
  refresh () {
    return true;
  }

  /**
   * Function to attach a DataFile to the engine and
   * register it with a DataFileUpdateService if needed
   *
   * @param {DataFile} dataFile the datafile to register
   */
  registerDataFile (dataFile) {
    this.registrationCallbacks.push(function (pipeline) {
      // Create datafile update service if not already created

      if (!pipeline.dataFileUpdateService) {
        pipeline.dataFileUpdateService = new DataFileUpdateService(pipeline);
      }

      pipeline.dataFileUpdateService.registerDataFile(dataFile);
    });
  }
}

module.exports = Engine;
