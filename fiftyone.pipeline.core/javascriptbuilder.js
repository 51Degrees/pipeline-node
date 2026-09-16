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

// Evidence names the rendered script is not configured with. The script
// appends both to its own request itself, so naming them here as well would
// send each twice and, worse, put the session id into the record the script
// keeps of a request's inputs. That record decides whether a later page view
// in the same tab can be served from the cached response, and a session id is
// different on every page view, so a record holding one could never match.
// The same two are excluded by the .NET builder, which is the reference for
// this behaviour.
const excludedParameters = ['session-id', 'sequence'];

// The object name is written into the script as the name of a global
// variable, as a session storage key and inside string literals, with no
// escaping of JavaScript. A name that is not a plain JavaScript identifier
// would therefore break the script or change what it does, so only names
// matching this pattern are used.
const objectNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Words the pattern accepts that cannot be the name of the object. These are
// the reserved words of the language, including those reserved only in
// strict mode, plus the three global values a top level var cannot replace,
// where the object would silently never be created.
const reservedObjectNames = [
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'static', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'Infinity', 'NaN', 'undefined'
];

/**
 * Whether a name can be used as the name of the client side object.
 *
 * @param {*} name the requested name
 * @returns {boolean} true if the name is a valid JavaScript identifier and
 * not a reserved word
 */
function isValidObjectName (name) {
  return typeof name === 'string' &&
    objectNamePattern.test(name) &&
    reservedObjectNames.indexOf(name) === -1;
}

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
   * side object with the JavaScript properties in it. This must be a valid
   * JavaScript identifier that is not a reserved word, or the constructor
   * throws. This can be overridden with "query.fod-js-object-name" evidence,
   * which is ignored with a warning when it is not a valid name.
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

    if (!isValidObjectName(objName)) {
      throw new Error(
        'JavaScriptBuilder objName is invalid. It must be a valid ' +
        'JavaScript identifier that is not a reserved word.');
    }

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

      // The URL keeps every parameter, as it always has. The object the
      // script is configured with leaves out the two it appends itself.
      const scriptParameters = {};
      for (const key in query) {
        if (excludedParameters.indexOf(key) === -1) {
          scriptParameters[key] = query[key];
        }
      }
      settings._parameters = JSON.stringify(scriptParameters);

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
    // Try and get the requested object name from evidence. A name that is
    // not a valid identifier is ignored and the configured name is used.
    const objName = flowData.evidence.get(Constants.evidenceObjectName);
    if (objName !== undefined) {
      if (isValidObjectName(objName)) {
        settings._objName = objName;
      } else {
        this._log('warn',
          'The requested JavaScript object name is not a valid JavaScript ' +
          'identifier, so the configured name "' + this.settings.objName +
          '" was used instead.');
      }
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
