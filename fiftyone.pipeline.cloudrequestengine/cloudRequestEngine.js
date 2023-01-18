/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2022 51 Degrees Mobile Experts Limited, Davidson House,
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

const require51 = (requestedPackage) => {
  try {
    return require(__dirname + '/../' + requestedPackage);
  } catch (e) {
    return require(requestedPackage);
  }
};
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
    this.cloudRequestOrigin = cloudRequestOrigin
    if (requestClient !== undefined) {
      this.requestClient = requestClient;
    }
    else {
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

    const self = this;

    Promise.all([this.getEvidenceKeys(), this.fetchProperties()]).then(function () {
      self.initialised = true;
    }).catch(function (errors) {
      self.initialised = false;

      self.errors = errors;

      if (self.pipelines) {
        // Log error on all pipelines engine is attached to

        self.pipelines.map(function (pipeline) {
          pipeline.log('error', {
            source: 'CloudRequestEngine',
            message: self.errors
          });
        });
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
      if (self.initialised === true) {
        resolve(self);
      } else if (self.initialised === false) {
        reject(self.errors);
      } else {
        const readyCheck = setInterval(function () {
          if (self.initialised === true) {
            clearInterval(readyCheck);
            resolve(self);
          } else if (self.initialised === false) {
            reject(self.errors);
            clearInterval(readyCheck);
          }
        });
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
   * @param {String} response the response data to process
   * @returns {Array} The error messages
   */
  getErrorMessages(responseBody){
    let errors = [];
    try {
      errors = JSON.parse(responseBody).errors;  
    } catch (parseError) {
      errors = [ 'Error parsing response - ' + responseBody ];
    }
    if(responseBody.length == 0) {
      errors = [ 'No data in response from cloud service' ];
    }
    return errors;
  }

  /**
   * Used to handle errors from http requests
   */
   getErrorsFromResponse(response) {    
    let content = response;
    if(response.content) {
      content = response.content;
    }

    let errors = this.getErrorMessages(content); 
    let cloudErrors = [];
    errors.forEach(function(errorText) {
      cloudErrors.push(new CloudRequestError(
        errorText, 
        response.headers, 
        response.statusCode));           
    });

    if(cloudErrors.length == 0 &&
      response.statusCode > 299) {
        let message = 'Cloud service returned status code ' + 
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
   * @returns {Promise} properties from the cloud server
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
      }).catch(function(response) {
        reject(engine.getErrorsFromResponse(response));
      });
    });
  }

  propertiesTransform(properties) {
    let result = {};
    let self = this;
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

  metaPropertyTransform(key, value) {
    switch (key) {
      case "itemproperties":
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
        }).catch(function(response) {
          self.errors = engine.getErrorsFromResponse(response)
          reject(self.errors);
        });
    });
  }

  /**
   * Internal function to get evidenceKeys used by cloud resourcekey
   *
   * @returns {Array} evidence key list
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
      }).catch(function(response) {
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
   * @param {FlowData} flowData
   * @returns {Evidence} Evidence Dictionary
   */
  getContent(flowData) {
    let queryData = {};

    const evidence = flowData.evidence.getAll();

    // Add evidence in reverse alphabetical order, excluding special keys. 
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, "other"));
    // Add cookie evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, "cookie"));
    // Add header evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, "header"));
    // Add query evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, "query"));

    return queryData;
  }

  /**
   * Add query data to the evidence.
   * @param {object} queryData The destination dictionary to add query data to.
   * @param {Evidence} allEvidence All evidence in the flow data. This is used to
   * report which evidence keys are conflicting.
   * @param {object} evidence Evidence to add to the query Data.
   */
  addQueryData(flowData, queryData, allEvidence, evidence) {

    for (const [evidenceKey, evidenceValue] of Object.entries(evidence)) {
      // Get the key parts
      const evidenceKeyParts = evidenceKey.split('.')
      const prefix = evidenceKeyParts[0]
      const suffix = evidenceKeyParts[1];

      // Check and add the evidence to the query parameters.
      if ((suffix in queryData) == false) {
        queryData[suffix] = evidenceValue
      }
      else {
        // If the queryParameter exists already.
        // Get the conflicting pieces of evidence and then log a 
        // warning, if the evidence prefix is not query. Otherwise a
        // warning is not needed as query evidence is expected 
        // to overwrite any existing evidence with the same suffix.
        if (prefix !== "query") {
          let conflicts = {}
          for (const [key, value] of Object.entries(allEvidence)) {
            if (key !== evidenceKey && key.includes(suffix)) {
              conflicts[key] = value
            }
          }
          
          let conflictStr = '';
          for (const [key, value] of Object.entries(conflicts)) {
            if (conflictStr.length > 0) {
              conflictStr += ', ';
            }
            conflictStr += util.format('%s:%s', key, value);
          }
          
          let warningMessage = util.format(
            errorMessages.evidenceConflict,
            evidenceKey,
            evidenceValue,
            conflictStr);
          flowData.pipeline.log('warn', warningMessage);
        }
        // Overwrite the existing queryParameter value.
        queryData[suffix] = evidenceValue
      }
    }
  }

  /**
   * Get evidence with specified prefix.
   * @param {Evidence} evidence All evidence in the flow data.
   * @param {stirng} type Required evidence key prefix
   */
  getSelectedEvidence(evidence, type) {
    let selectedEvidence = {}

    if (type === "other") {
        for (const [key, value] of Object.entries(evidence)) {
          if (this.hasKeyPrefix(key, "query") === false &&
            this.hasKeyPrefix(key, "header") === false &&
            this.hasKeyPrefix(key, "cookie") === false ) {
              selectedEvidence[key] = value
            }
        }
        selectedEvidence = Object.keys(selectedEvidence).sort().reverse().reduce(
          (obj, key) => { 
            obj[key] = selectedEvidence[key]; 
            return obj;
          }, 
          {}
        );
    }
    else {
      for (const [key, value] of Object.entries(evidence)) {
        if (this.hasKeyPrefix(key, type)) {
          selectedEvidence[key] = value
        }
      }
    }
    return selectedEvidence
  }
  
  /**
   * Check that the key of a KeyValuePair has the given prefix.
   * @param {string} itemKey Key to check
   * @param {string} prefix The prefix to check for.
   * @returns True if the key has the prefix.
   */
  hasKeyPrefix(itemKey, prefix) {
    return itemKey.startsWith(prefix + '.')
  }
}

module.exports = CloudRequestEngine;
