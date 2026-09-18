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

const url = require('url');

const formContentType = 'application/x-www-form-urlencoded';

/**
 * Whether the request is a POST whose body is a form.
 *
 * @param {object} request an HTTP request object
 * @returns {boolean} true for a POST with a form content type
 */
const isFormPost = function (request) {
  if (typeof request.method !== 'string' ||
    request.method.toUpperCase() !== 'POST' ||
    !request.headers) {
    return false;
  }
  const name = Object.keys(request.headers)
    .find(key => key.toLowerCase() === 'content-type');
  const contentType = name === undefined ? undefined : request.headers[name];
  return typeof contentType === 'string' &&
    contentType.toLowerCase().startsWith(formContentType);
};

/**
 * The name and value pairs of a form body, with the values of a repeated
 * name joined by commas as the .NET web integration joins them.
 *
 * @param {object|string|Buffer} body the parsed form or the body text
 * @returns {Array<Array<string>>} the name and value pairs
 */
const formEntries = function (body) {
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const params = new URLSearchParams(body.toString());
    return [...new Set(params.keys())]
      .map(name => [name, params.getAll(name).join(',')]);
  }
  if (typeof body === 'object') {
    return Object.entries(body).map(([name, value]) =>
      [name, Array.isArray(value) ? value.join(',') : value]);
  }
  return [];
};

/**
 * Read a form body from a request into request.body, unless the request is
 * not a form POST, something has read the body already, or the body is
 * larger than the limit.
 *
 * @param {object} request an HTTP request object
 * @param {number} maxBytes the largest body read
 * @returns {Promise<void>} resolves once the body has been read
 */
const readFormBody = function (request, maxBytes) {
  return new Promise((resolve, reject) => {
    if (!isFormPost(request) ||
      request.body !== undefined ||
      typeof request.on !== 'function' ||
      request.readableEnded === true) {
      resolve();
      return;
    }
    const chunks = [];
    let length = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        tooLarge = true;
      } else if (tooLarge === false) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    });
    request.on('end', () => {
      if (tooLarge === false) {
        request.body = Buffer.concat(chunks).toString('utf8');
      }
      resolve();
    });
    request.on('error', reject);
  });
};

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
   * headers, cookies, protocol, IP, query params and, for a POST with a
   * form body, the form values.
   *
   * Form values are added as query evidence after the query string, so a
   * form value replaces a query string value of the same name. They are
   * read from request.body, which a framework's form parser sets, either as
   * an object or as the body text. A plain Node request has no request.body,
   * so use addFromRequestAsync to read the body from the request instead.
   * The 51Degrees client script sends its values in a form body, so without
   * one or the other they never reach the pipeline.
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

    // Add form values, after the query string so that they replace it.
    if (isFormPost(request) && request.body !== undefined &&
      request.body !== null) {
      for (const [name, value] of formEntries(request.body)) {
        evidence.add('query.' + name, value);
      }
    }

    return this;
  }

  /**
   * Add evidence to flowData from an HTTP request, first reading a form
   * body from the request when it is a POST with a form body and nothing
   * has read the body already. The body text is kept in request.body, and
   * then addFromRequest adds the evidence. A body larger than
   * maxFormBytes is not read and no form values are added.
   *
   * @param {object} request an HTTP request object
   * @param {number} [maxFormBytes] the largest form body read, one
   * mebibyte unless given
   * @returns {Promise<Evidence>} the updated evidence
   */
  addFromRequestAsync (request, maxFormBytes = 1024 * 1024) {
    return readFormBody(request, maxFormBytes)
      .then(() => this.addFromRequest(request));
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
