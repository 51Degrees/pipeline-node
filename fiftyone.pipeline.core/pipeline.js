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

const FlowData = require('./flowData');
const EventEmitter = require('events');

/**
 * @typedef {import('./flowElement')} FlowElement
 */

/**
 * Pipeline holding a list of flowElements for processing, can create
 * flowData that will be passed through these, collecting elementData
 * Should be constructed through the PipelineBuilder class
 */
class Pipeline {
  /**
   * Constructor for Pipeline
   *
   * @param {FlowElement[]} flowElements list of FlowElements to
   * add to the Pipeline
   * @param {number} suppressProcessExceptions If true then pipeline
   * will suppress exceptions added to FlowData.
   * @param {EventEmitter} eventEmitter A logger for emitting messages
   */
  constructor (flowElements = [], suppressProcessExceptions = false, eventEmitter = null) {
    const pipeline = this;

    // The chain of flowElements to run, including arrays of parallel elements
    this.flowElementsChain = flowElements;

    // If true then pipeline will suppress exceptions added to FlowData.
    this.suppressProcessExceptions = suppressProcessExceptions;

    // A logger for emitting messages
    if (eventEmitter) {
      this.eventEmitter = eventEmitter;
    } else {
      this.eventEmitter = new EventEmitter();
    }

    // Flattened dictionary of flowElements the pipeline contains
    /**
     * @type {object}
     */
    this.flowElements = {};

    // Run through flowElements and store them by dataKey
    // in the pipeline.flowElements object.
    // Recursive function so it can handle parallel elements
    // which are passed in as arrays
    const storeInFlowElementList = function (flowElemmentList) {
      flowElemmentList.forEach(function (slot) {
        if (Array.isArray(slot)) {
          storeInFlowElementList(slot);
        } else {
          // Run registration function
          slot.onRegistration(pipeline, slot);

          pipeline.flowElements[slot.dataKey] = slot;

          // Register link between flowElement and a pipeline it's been added to
          slot.pipelines.push(pipeline);
        }
      });
    };

    storeInFlowElementList(flowElements);

    // Empty property database, later populated and possibly
    // updated by flowElements' property lists
    /**
     * @type {object}
     */
    this.propertyDatabase = {};

    // Update property list - Note that some of these could be async
    // so the property list might not be updated straight away.
    // When this happens, getWhere calls will return
    // empty for those specific properties
    Object.keys(pipeline.flowElements).forEach(function (key) {
      const flowElement = pipeline.flowElements[key];
      pipeline.updatePropertyDataBaseForElement(flowElement);
    });

    // Create the FlowData process function here to save
    // having to do it each time the FlowData is processed.
    // This packages up all the logic for generating promises,
    // sync / async and others
    const processMethod = function () {
      const promiseChain = [];

      const makeProcessPromise = function (flowElement) {
        return function (flowData) {
          if (flowData.stopped) {
            return Promise.resolve(flowData);
          }

          pipeline.eventEmitter.emit(
            'info',
            'processing ' + flowElement.dataKey
          );

          return new Promise(function (resolve) {
            const setError = function (error) {
              flowData.setError(error, flowElement);

              return resolve(flowData);
            };

            const local = {};

            let process;

            try {
              process = Promise.resolve(flowElement.process(flowData, local));
            } catch (e) {
              return setError(e);
            }

            process
              .then(function () {
                resolve(flowData);
              })
              .catch(setError);

            if (flowData.errors !== undefined && Object.entries(flowData.errors).length !== 0 && !pipeline.suppressProcessExceptions) {
              throw Object.values(flowData.errors)[0];
            }
          });
        };
      };

      pipeline.flowElementsChain.forEach(function (item) {
        if (Array.isArray(item)) {
          promiseChain.push(function (flowData) {
            const promises = [];

            item.forEach(function (flowElement) {
              const promise = makeProcessPromise(flowElement)(flowData);

              promises.push(promise);
            });

            return Promise.all(promises.map((p) => p.catch((e) => e)))
              .then((results) => flowData)
              .catch((e) => console.log(e));
          });
        } else {
          promiseChain.push(makeProcessPromise(item));
        }
      });

      return function (flowData) {
        return promiseChain.reduce(function (cur, next) {
          return cur.then(next);
        }, Promise.resolve(flowData));
      };
    };

    this.processMethod = processMethod();
  }

  /**
   * get a FlowElement by its dataKey
   *
   * @param {string} key the datakey of the FlowElement
   * @returns {FlowElement} the FlowElement for the datakey
   */
  getElement (key) {
    return this.flowElements[key];
  }

  /**
   * Method to attach listeners to the logger
   * Shorthand access to the enclosed event emitter
   *
   * @param {string} listener type of message to listen to
   * @param {Function} callback a callback to react to the log
   */
  on (listener, callback) {
    this.eventEmitter.on(listener, callback);
  }

  /**
   * Shorthand to trigger a message on the pipeline's eventEmitter
   *
   * @param {string} type type of message
   * @param {*} message message to store in the log
   */
  log (type, message) {
    this.eventEmitter.emit(type, message);
  }

  /**
   * Create a FlowData element from the pipeline
   *
   * @returns {FlowData} a FlowData object for the Pipeline
   * containing methods for adding evidence and processing via
   * the FlowElements in the Pipleine.
   */
  createFlowData () {
    return new FlowData(this);
  }

  /**
   *  Update pipeline's property database for FlowElement
   *
   * @param {FlowElement} flowElement FlowElement to update
   * @returns {void}
   */
  updatePropertyDataBaseForElement (flowElement) {
    const pipeline = this;

    return new Promise(function (resolve) {
      // First delete any instances of properties for this element

      Object.keys(pipeline.propertyDatabase).forEach(function (metaKey) {
        Object.keys(pipeline.propertyDatabase[metaKey]).forEach(function (
          metaValue
        ) {
          const list = pipeline.propertyDatabase[metaKey][metaValue];
          Object.keys(list).forEach(function (key) {
            const value = list[key];
            if (value.flowElementKey === flowElement.dataKey) {
              delete pipeline.propertyDatabase[metaKey][metaValue][key];
            }
          });
        });
      });

      Promise.resolve(flowElement.getProperties()).then(function (properties) {
        const flowElementDataKey = flowElement.dataKey;

        if (!properties) {
          return;
        }

        Object.keys(properties).forEach(function (
          propertyKey
        ) {
          const propertyMeta = properties[propertyKey];
          const propertyName = propertyKey;

          Object.keys(propertyMeta).forEach(function (metaKey) {
            const metaValue = propertyMeta[metaKey].toString().toLowerCase();
            metaKey = metaKey.toLowerCase();

            if (!pipeline.propertyDatabase[metaKey]) {
              pipeline.propertyDatabase[metaKey] = {};
            }

            if (!pipeline.propertyDatabase[metaKey][metaValue]) {
              pipeline.propertyDatabase[metaKey][metaValue] = {};
            }

            pipeline.propertyDatabase[metaKey][metaValue][propertyKey] = {
              propertyName,
              flowElementKey: flowElementDataKey
            };
          });
        });

        resolve();
      });
    });
  }
}

module.exports = Pipeline;
