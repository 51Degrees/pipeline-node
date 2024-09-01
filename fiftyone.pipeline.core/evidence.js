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

const url = require('url');

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * Storage of evidence on a flowData object
 */
class Evidence {
  /**
   * Constructor for evidence
   *
   * @param {FlowData} flowData FlowData to add the evidence to
   */
  constructor (flowData) {
    this.flowData = flowData;
    this.evidenceStore = {};
  }

  /**
   * Add a piece of evidence to flowData
   *
   * @param {string} key evidence key to add
   * @param {*} value value of evidence key
   */
  add (key, value) {
    // Filter out any evidence that isn't needed in the pipeline

    let keep;

    for (let flowElement in this.flowData.pipeline.flowElements) {
      flowElement = this.flowData.pipeline.flowElements[flowElement];

      if (flowElement.evidenceKeyFilter.filterEvidenceKey(key)) {
        keep = true;
      }
    }

    if (keep) {
      this.flowData.pipeline.log('debug', key + ' added to evidence');

      this.evidenceStore[key] = value;
    } else {
      this.flowData.pipeline.log(
        'debug',
        key + ' filtered out of evidence. Not added.'
      );
    }
  }

  /**
   * Add a piece of evidence to flowData as an object
   *
   * @param {object} evidenceObject key value map of evidence
   * @param {string} evidenceObject.key evidencekey
   * @param {*} evidenceObject.value evidence value
   */
  addObject (evidenceObject) {
    const evidenceContainer = this;

    Object.keys(evidenceObject).forEach(function (key) {
      evidenceContainer.add(key, evidenceObject[key]);
    });
  }

  /**
   * Add evidence to flowData from an HTTP request
   * This helper automatically adds evidence:
   * headers, cookies, protocol, IP and query params
   *
   * @param {object} request an HTTP request object
   * @returns {Evidence} return updated evidence
   */
  addFromRequest (request) {
    // Process headers

    const evidence = this;

    Object.keys(request.headers).forEach(key => {
      const value = request.headers[key];
      let requestHeaderKey;
      let requestHeaderValue;

      if (key !== 'cookie') {
        requestHeaderKey = 'header' + '.' + key;

        requestHeaderValue = value;

        evidence.add(requestHeaderKey, requestHeaderValue);
      } else {
        value.split(';').forEach((cookie) => {
          const parts = cookie.split('=');

          requestHeaderKey = 'cookie' + '.' + parts.shift().trim();

          requestHeaderValue = decodeURI(parts.join('='));

          evidence.add(requestHeaderKey, requestHeaderValue);
        });
      }
    });

    // Add protocol

    evidence.add(
      'header.protocol',
      request.connection.encrypted ? 'https' : 'http'
    );

    // Use referer header to set protocol if set

    if (request.headers.referer) {
      evidence.add(
        'header.protocol',
        new url.URL(request.headers.referer).protocol.replace(':', '')
      );
    }

    // Add IP address

    evidence.add(
      'server.client-ip',
      request.connection.remoteAddress.toString()
    );

    evidence.add('server.host-ip', request.connection.localAddress.toString());

    // Parsing URL using new URL constructor

    const protocol = request.protocol || 'http';
    const hostname = request.hostname || 'localhost'; // Use a default hostname if not available
    const port = request.socket?.localPort || ''; // Port may not be available in some cases

    // If request.url already contains the protocol, hostname, and port, use it as is
    const fullURL = request.url.includes('://') ? request.url : `${protocol}://${hostname}${port ? `:${port}` : ''}${request.url}`;

    // Get querystring data

    const URL = new url.URL(fullURL);
    const query = URL.searchParams;

    query.forEach(function (value, param) {
      evidence.add('query.' + param, value);
    });

    return this;
  }

  /**
   * Get a piece of evidence
   *
   * @param {string} key evidence key to retreive
   * @returns {*} the evidence value
   */
  get (key) {
    return this.evidenceStore[key];
  }

  /**
   * Get all evidence
   *
   * @returns {object} all evidence
   */
  getAll () {
    return this.evidenceStore;
  }
}

module.exports = Evidence;
