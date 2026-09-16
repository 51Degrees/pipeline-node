/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
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

// Evidence names the rendered script is not configured with. The script
// appends both to its own request itself, so naming them here as well would
// send each twice and, worse, put the session id into the record the script
// keeps of a request's inputs. That record decides whether a later page view
// in the same tab can be served from the cached response, and a session id is
// different on every page view, so a record holding one could never match.
// The same two are excluded by the .NET builder, which is the reference for
// this behaviour.
const excludedParameters = ['session-id', 'sequence'];

/**
 * Encode a parameter name or value the way the .NET builder does with
 * WebUtility.UrlEncode, which is the reference. The script joins the
 * rendered parameters into its request body as they stand, so they must be
 * encoded here. The differences from encodeURIComponent are that a space
 * becomes a plus sign and that a tilde and an apostrophe are encoded too.
 *
 * @param {*} value the name or value to encode
 * @returns {string} the encoded text
 */
const urlEncode = function (value) {
  return encodeURIComponent(String(value))
    .replace(/[~']/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
};

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
   * For more details on personal data policy, see https://51degrees.com/terms/client-services-privacy-policy/?utm_source=code&utm_medium=comment&utm_campaign=pipeline-node&utm_content=fiftyone.pipeline.core-javascriptbuilder.js&utm_term=constructor
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
      // The URL is the protocol, the host and the endpoint and nothing
      // else, as the .NET builder renders it. The values the page was
      // requested with go in the request body as the parameters below, so
      // none of them, the visitor's User-Agent and address included, are
      // written into a URL that servers and proxies log. Exactly one slash
      // separates the host from the endpoint.
      let endPoint = settings._endPoint;
      const hostHasSlash = settings._host.endsWith('/');
      const endPointHasSlash = endPoint.startsWith('/');
      if (hostHasSlash === false && endPointHasSlash === false) {
        endPoint = '/' + endPoint;
      } else if (hostHasSlash && endPointHasSlash) {
        endPoint = endPoint.substring(1);
      }
      settings._url = settings._protocol + '://' + settings._host + endPoint;

      // The parameters are the query evidence, each named by everything
      // after the first dot of its key so that a name such as id.usage is
      // kept whole, and leaving out the two the script appends itself. The
      // script joins them into its request body as they stand, so each name
      // and value is encoded here.
      const evidence = this.evidenceKeyFilter.filterEvidence(
        flowData.evidence.getAll()
      );
      const scriptParameters = {};
      for (const key in evidence) {
        if (key.startsWith('query.')) {
          const name = key.substring('query.'.length);
          if (excludedParameters.indexOf(name) === -1) {
            scriptParameters[urlEncode(name)] = urlEncode(evidence[key]);
          }
        }
      }
      settings._parameters = JSON.stringify(scriptParameters);

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
