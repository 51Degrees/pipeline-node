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

const mustache = require('mustache');
const fs = require('fs');
const querystring = require('querystring');
const path = require('path');

const template = fs.readFileSync(
  path.resolve(__dirname, 'javascript-templates', 'JavaScriptResource.mustache'),
  'utf8'
);

const FlowElement = require('./flowElement.js');
const EvidenceKeyFilter = require('./evidenceKeyFilter.js');
const ElementDataDictionary = require('./elementDataDictionary.js');
const Constants = require('./constants.js');
const uglifyJS = require('uglify-js');

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * An instance of EvidenceKeyFilter which removes all but header
 * and query evidence as that is all that is used by
 * the JavaScript builder
 **/
class JSEvidenceKeyFilter extends EvidenceKeyFilter {
  filterEvidenceKey (key) {
    return key.indexOf('query.') !== -1 || key.indexOf('header.') !== -1;
  }
}

/**
 * The JavaScriptBuilder aggregates JavaScript properties
 * from FlowElements in the pipeline. This JavaScript also
 * (when needed) generates a fetch request to retrieve additional properties
 * populated with data from the client side
 * It depends on the JSON Bundler element
 * (both are automatically added to a pipeline unless
 * specifically removed) for its list of properties.
 * The results of the JSON Bundler should also be used in a
 * user-specified endpoint which retrieves the JSON from the
 * client side. The JavaScriptBuilder is constructed with a
 * url for this endpoint.
 */
class JavaScriptBuilderElement extends FlowElement {
  /**
   * Constructor for JavaScriptBuilder.
   *
   * @param {object} options options object
   * @param {string} options.objName the name of the client
   * side object with the JavaScript properties in it
   * @param {string} options.protocol The protocol ("http" or "https")
   * used by the client side callback url.
   * This can be overriden with header.protocol evidence
   * @param {string} options.host The host of the client side
   * callback url. This can be overriden with header.host evidence.
   * @param {string} options.endPoint The endpoint of the client side
   * callback url
   * @param {boolean} options.enableCookies Whether the client JavaScript
   * stored results of client side processing in cookies. This can also
   * be set per request, using the "query.fod-js-enable-cookies" evidence key.
   * For more details on personal data policy, see http://51degrees.com/terms/client-services-privacy-policy/
   * @param {boolean} options.minify Whether to minify the JavaScript
   */
  constructor ({
    objName = 'fod',
    protocol = '',
    host = '',
    endPoint = '',
    enableCookies = true,
    minify = false
  } = {}) {
    super(...arguments);

    this.settings = {
      objName,
      protocol,
      host,
      endPoint,
      enableCookies,
      minify
    };

    this.dataKey = 'javascriptbuilder';
    this.evidenceKeyFilter = new JSEvidenceKeyFilter();
  }

  /**
   * Internal process function of the JavaScript builder
   * Gets JSON from the JSONBundler and constructs JavaScript
   * to place on the client side
   *
   * @param {FlowData} flowData to process
   * @returns {undefined}
   */
  processInternal (flowData) {
    // Get output of jsonbuilder

    const json = flowData.jsonbundler.json;

    const settings = { _jsonObject: JSON.stringify(json) };

    for (const setting in this.settings) {
      settings['_' + setting] = this.settings[setting];
    }

    // Generate url from parts
    let protocol = this.settings.protocol;
    let host = this.settings.host;

    if (!protocol) {
      // Check if protocol is provided in evidence
      if (flowData.evidence.get('header.protocol')) {
        protocol = flowData.evidence.get('header.protocol');
      }
    }
    if (!protocol) {
      protocol = 'https';
    }

    if (!host) {
      // Check if host is provided in evidence
      if (flowData.evidence.get('header.host')) {
        host = flowData.evidence.get('header.host');
      }
    }

    settings._host = host;
    settings._protocol = protocol;

    if (settings._host && settings._protocol && settings._endPoint) {
      settings._url =
        settings._protocol + '://' + settings._host + settings._endPoint;

      // Get query parameters to add to the URL

      const queryParams = this.evidenceKeyFilter.filterEvidence(
        flowData.evidence.getAll()
      );

      const query = {};

      for (const param in queryParams) {
        if (param.indexOf('query') !== -1) {
          const paramKey = param.split('.')[1];

          query[paramKey] = queryParams[param];
        }
      }

      const urlQuery = querystring.stringify(query);
      settings._parameters = JSON.stringify(query);

      // Does the URL already have a query string in it?

      if (settings._url.indexOf('?') === -1) {
        settings._url += '?';
      } else {
        settings._url += '&';
      }

      settings._url += urlQuery;

      settings._updateEnabled = true;
    } else {
      settings._updateEnabled = false;
    }

    // Use results from device detection if available to determine
    // if the browser supports promises.

    let promises;
    try {
      promises = flowData.device !== undefined &&
        flowData.device.promise !== undefined &&
        flowData.device.promise.hasValue === true &&
        flowData.device.promise.value === true;
    } catch (e) {
      promises = false;
    }
    settings._supportsPromises = promises;

    settings._hasDelayedProperties = settings._jsonObject.includes('delayexecution');

    settings._sessionId = flowData.evidence.get('query.session-id');
    settings._sequence = flowData.evidence.get('query.sequence');

    // Try and get the requested enable cookies from evidence.
    const enableCookies = flowData.evidence.get(Constants.evidenceEnableCookies);
    if (enableCookies !== undefined) {
      settings._enableCookies = (enableCookies?.toLowerCase?.() === 'true');
    }
    // Try and get the requested object name from evidence.
    const objName = flowData.evidence.get(Constants.evidenceObjectName);
    if (objName !== undefined) {
      settings._objName = (objName);
    }

    let output = mustache.render(template, settings);

    if (settings._minify) {
      const minified = uglifyJS.minify(output);
      if (minified.error === null) {
        output = minified.code;
      }
    }

    const data = new ElementDataDictionary({
      flowElement: this,
      contents: { javascript: output }
    });

    flowData.setElementData(data);
  }
}

module.exports = JavaScriptBuilderElement;
