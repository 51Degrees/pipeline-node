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
const Engine = require('fiftyone.pipeline.engines').Engine;
const AspectDataDictionary = require('fiftyone.pipeline.engines')
  .AspectDataDictionary;
const BasicListEvidenceKeyFilter = require('fiftyone.pipeline.core')
  .BasicListEvidenceKeyFilter;
const sharedValues = require('./sharedValues');
const errorMessages = require('./errorMessages');
const RequestClient = require('./requestClient');
const CloudRequestError = require('./cloudRequestError');

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').Evidence} Evidence
 */

// Engine that makes a call to the 51Degrees cloud service
// Returns raw JSON as a "cloud" property under "cloud" dataKey
class CloudRequestEngine extends Engine {
  /**
   * Constructor for CloudRequestEngine
   *
   * @param {object} options options object
   * @param {string} options.resourceKey resourcekey for cloud service
   * @param {string} options.licenseKey licensekey for cloud service
   * @param {string} options.baseURL url the cloud service is located at
   * if overriding default
   * @param {string} options.cloudRequestOrigin The value to set for the Origin
   * header when making requests to the cloud service.
   * This is used by the cloud service to check that the request is being
   * made from a origin matching those allowed by the resource key.
   * For more detail, see the 'Request Headers' section in the
   * <a href="https://cloud.51degrees.com/api-docs/index.html">cloud documentation</a>.
   * @param {RequestClient} options.requestClient Set predefined RequestClient.
   */
  constructor (
    {
      resourceKey,
      licenseKey,
      baseURL,
      cloudRequestOrigin,
      requestClient
    }) {
    super(...arguments);

    this.dataKey = 'cloud';

    if (!resourceKey) {
      throw 'Cloud engine needs a resourceKey';
    }

    this.resourceKey = resourceKey;
    this.licenseKey = licenseKey;
    this.cloudRequestOrigin = cloudRequestOrigin;
    if (requestClient !== undefined) {
      this.requestClient = requestClient;
    } else {
      this.requestClient = new RequestClient();
    }

    // Check if baseURL is set. If not try to set it the environment variable
    // if presents, else set to default value
    if (!baseURL) {
      baseURL = process.env.FOD_CLOUD_API_URL;
      if (!baseURL) {
        baseURL = sharedValues.baseURLDefault;
      }
    }

    // Check if the set baseURL ends with '/'
    if (baseURL && baseURL.endsWith('/') === false) {
      baseURL = baseURL + '/';
    }
    this.baseURL = baseURL;
    this.evidenceKeys = [];

    // Properties of connected FlowElements
    this.flowElementProperties = {};
  }

  /**
   * Check if the keys and properties have been fetched.
   *
   * This computed property determines whether the keys of a 'flowElementProperties' object and the 'evidenceKeyFilter'
   * array both have elements, indicating that the necessary data has been fetched and is ready for use.
   *
   * @returns {boolean} True if the keys and properties are fetched and ready; otherwise, false.
   */
  get keysAndPropertiesFetched () {
    return Object.keys(this.flowElementProperties).length > 0 && this.evidenceKeyFilter.length > 0;
  }

  /**
   * Fetches evidence keys and properties data.
   *
   * This method asynchronously fetches evidence keys and properties required for the operation.
   * It uses Promises to handle data retrieval and provides callback functions for success and failure scenarios.
   *
   * @param {Function} resolveCallback - A callback function to be called when the data is successfully fetched.
   * It will receive the current instance as a parameter.
   *
   * @param {Function} rejectCallback - A callback function to be called when an error occurs during data retrieval.
   * It will receive the error information as a parameter.
   */
  fetchEvidenceKeysAndProperties (resolveCallback, rejectCallback) {
    const self = this;
    Promise.all([this.getEvidenceKeys(), this.fetchProperties()]).then(function () {
      resolveCallback(self);
    }).catch(function (errors) {
      self.errors = errors;
      if (self.pipelines) {
        // Log error on all pipelines engine is attached to
        self.pipelines.forEach(function (pipeline) {
          pipeline.log('error', {
            source: 'CloudRequestEngine',
            message: self.errors
          });
        });
        rejectCallback(self.errors);
      }
    });
  }

  /**
   * Function for testing if the cloud engine is ready
   * Checks to see if properties and evidence keys have been fetched
   *
   * @returns {Promise} whether ready
   */
  ready () {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (self.keysAndPropertiesFetched) {
        resolve(self);
      } else {
        self.fetchEvidenceKeysAndProperties(resolve, reject);
      }
    });
  }

  /**
   * Internal process for cloud engine
   * Returns raw JSON as a "cloud" property in "cloud"
   *
   * @param {FlowData} flowData flowData to process
   * @returns {Promise} data from cloud service
   */
  processInternal (flowData) {
    const engine = this;
    return engine.getData(flowData);
  }

  /**
   * Typically, cloud will return errors as JSON.
   * However, transport level errors or other failures can result in
   * responses that are plain text. This function handles these cases.
   *
   * @param {string} responseBody the response data to process
   * @returns {Array} The error messages
   */
  getErrorMessages (responseBody) {
    let errors = [];
    try {
      errors = JSON.parse(responseBody).errors;
    } catch (parseError) {
      errors = ['Error parsing response - ' + responseBody];
    }
    if (responseBody.length === 0) {
      errors = ['No data in response from cloud service'];
    }
    return errors;
  }

  /**
   * Used to handle errors from http requests
   *
   * @param {import('http').ServerResponse} response Responce to get errors from
   * @returns {Array<CloudRequestError>} Array of CloudRequestError from response
   */
  getErrorsFromResponse (response) {
    let content = response;
    if (response.content) {
      content = response.content;
    }

    const errors = this.getErrorMessages(content);
    const cloudErrors = [];
    errors.forEach(function (errorText) {
      cloudErrors.push(new CloudRequestError(
        errorText,
        response.headers,
        response.statusCode));
    });

    if (cloudErrors.length === 0 &&
      response.statusCode > 299) {
      const message = 'Cloud service returned status code ' +
        response.statusCode + ' with content ' + content + '.';
      cloudErrors.push(new CloudRequestError(
        message,
        response.headers,
        response.statusCode));
    }

    return cloudErrors;
  }

  /**
   * Internal process to fetch all the properties available under a resourcekey
   *
   * @returns {Promise<object>} properties from the cloud server
   */
  fetchProperties () {
    const engine = this;

    return new Promise(function (resolve, reject) {
      let url = engine
        .baseURL +
        'accessibleproperties?resource=' +
        engine.resourceKey;

      // licenseKey is optional
      if (engine.licenseKey) {
        url += '&license=' + engine.licenseKey;
      }

      engine.requestClient.get(url, engine.cloudRequestOrigin)
        .then(function (properties) {
          const propertiesOutput = {};

          properties = JSON.parse(properties);

          const products = properties.Products;

          for (const product in products) {
            propertiesOutput[product] = engine.propertiesTransform(
              products[product].Properties);
          }

          engine.flowElementProperties = propertiesOutput;
          resolve(propertiesOutput);
        }).catch(function (response) {
          reject(engine.getErrorsFromResponse(response));
        });
    });
  }

  /**
   * Properties transform
   *
   * @param {object} properties properties to transform
   * @returns {object} transformed properties
   */
  propertiesTransform (properties) {
    const result = {};
    const self = this;
    properties
      .forEach(function (property) {
        result[property
          .Name
          .toLowerCase()
        ] = {};
        for (const metaKey in property) {
          result[property.Name.toLowerCase()][metaKey.toLowerCase()] =
            self.metaPropertyTransform(
              metaKey.toLowerCase(),
              property[metaKey]);
        }
      });
    return result;
  }

  /**
   * Meta property transform
   *
   * @param {string} key key to check
   * @param {object} value properties to transform
   * @returns {object} transformed properties
   */
  metaPropertyTransform (key, value) {
    switch (key) {
      case 'itemproperties':
        return this.propertiesTransform(value);
      default:
        return value;
    }
  }

  /**
   * Internal function to get data from cloud service
   *
   * @param {FlowData} flowData
   * FlowData used to extract evidence and send to cloud service
   * for processing
   * @returns {Promise} result of processing
   */
  getData (flowData) {
    const engine = this;

    let url = this.baseURL +
      this.resourceKey + '.json';

    // licensekey is optional
    if (this.licenseKey) {
      url += '?license=' + this.licenseKey;
    }

    const self = this;

    return new Promise(function (resolve, reject) {
      engine.requestClient.post(
        url,
        engine.getContent(flowData),
        engine.cloudRequestOrigin)
        .then(function (body) {
          const data = new AspectDataDictionary({
            flowElement: engine,
            contents: {
              cloud: body,
              properties: engine.properties
            }
          });

          flowData.setElementData(data);

          resolve();
        }).catch(function (response) {
          self.errors = engine.getErrorsFromResponse(response);
          reject(self.errors);
        });
    });
  }

  /**
   * Internal function to get evidenceKeys used by cloud resourcekey
   *
   * @returns {Promise} evidence promise
   */
  getEvidenceKeys () {
    const engine = this;
    const url = this.baseURL + 'evidencekeys';
    return new Promise(function (resolve, reject) {
      engine.requestClient.get(url, engine.cloudRequestOrigin)
        .then(function (body) {
          engine.evidenceKeyFilter = new BasicListEvidenceKeyFilter(
            JSON.parse(body)
          );

          resolve();
        }).catch(function (response) {
          reject(engine.getErrorsFromResponse(response));
        });
    });
  }

  /**
   * Generate the Content to send in the POST request. The evidence keys
   * e.g. 'query.' and 'header.' have an order of precedence. These are
   * added to the evidence in reverse order, if there is conflict then
   * the queryData value is overwritten.
   * 'query.' evidence should take precedence over all other evidence.
   * If there are evidence keys other than 'query.' that conflict then
   * this is unexpected so a warning will be logged.
   *
   * @param {FlowData} flowData FlowData to get evidence from
   * @returns {object} Evidence Dictionary
   */
  getContent (flowData) {
    const queryData = {};

    const evidence = flowData.evidence.getAll();

    // Add evidence in reverse alphabetical order, excluding special keys.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'other'));
    // Add cookie evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'cookie'));
    // Add header evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'header'));
    // Add query evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'query'));

    return queryData;
  }

  /**
   * Add query data to the evidence.
   *
   * @param {FlowData} flowData FlowData for logging
   * @param {object} queryData The destination dictionary to add query data to.
   * @param {Evidence} allEvidence All evidence in the flow data. This is used to
   * report which evidence keys are conflicting.
   * @param {object} evidence Evidence to add to the query Data.
   */
  addQueryData (flowData, queryData, allEvidence, evidence) {
    for (const [evidenceKey, evidenceValue] of Object.entries(evidence)) {
      // Get the key parts
      const evidenceKeyParts = evidenceKey.split('.');
      const prefix = evidenceKeyParts[0];
      const suffix = evidenceKeyParts[1];

      // Check and add the evidence to the query parameters.
      if ((suffix in queryData) === false) {
        queryData[suffix] = evidenceValue;
      } else {
        // If the queryParameter exists already.
        // Get the conflicting pieces of evidence and then log a
        // warning, if the evidence prefix is not query. Otherwise a
        // warning is not needed as query evidence is expected
        // to overwrite any existing evidence with the same suffix.
        if (prefix !== 'query') {
          const conflicts = {};
          for (const [key, value] of Object.entries(allEvidence)) {
            if (key !== evidenceKey && key.includes(suffix)) {
              conflicts[key] = value;
            }
          }

          let conflictStr = '';
          for (const [key, value] of Object.entries(conflicts)) {
            if (conflictStr.length > 0) {
              conflictStr += ', ';
            }
            conflictStr += util.format('%s:%s', key, value);
          }

          const warningMessage = util.format(
            errorMessages.evidenceConflict,
            evidenceKey,
            evidenceValue,
            conflictStr);
          flowData.pipeline.log('warn', warningMessage);
        }
        // Overwrite the existing queryParameter value.
        queryData[suffix] = evidenceValue;
      }
    }
  }

  /**
   * Get evidence with specified prefix.
   *
   * @param {Evidence} evidence All evidence in the flow data.
   * @param {string} type Required evidence key prefix
   * @returns {Evidence} Selected evidence
   */
  getSelectedEvidence (evidence, type) {
    let selectedEvidence = {};

    if (type === 'other') {
      for (const [key, value] of Object.entries(evidence)) {
        if (this.hasKeyPrefix(key, 'query') === false &&
          this.hasKeyPrefix(key, 'header') === false &&
          this.hasKeyPrefix(key, 'cookie') === false) {
          selectedEvidence[key] = value;
        }
      }
      selectedEvidence = Object.keys(selectedEvidence).sort().reverse().reduce(
        (obj, key) => {
          obj[key] = selectedEvidence[key];
          return obj;
        },
        {}
      );
    } else {
      for (const [key, value] of Object.entries(evidence)) {
        if (this.hasKeyPrefix(key, type)) {
          selectedEvidence[key] = value;
        }
      }
    }
    return selectedEvidence;
  }

  /**
   * Check that the key of a KeyValuePair has the given prefix.
   *
   * @param {string} itemKey Key to check
   * @param {string} prefix The prefix to check for.
   * @returns {boolean} True if the key has the prefix.
   */
  hasKeyPrefix (itemKey, prefix) {
    return itemKey.startsWith(prefix + '.');
  }
}

module.exports = CloudRequestEngine;
