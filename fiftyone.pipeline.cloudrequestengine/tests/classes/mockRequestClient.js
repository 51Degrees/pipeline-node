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

const defaultProperties = {
  Products: {
    device: {
      DataTier: 'CloudV4Free',
      Properties: [
        { Name: 'IsMobile', Type: 'Boolean', Category: 'Device', DelayExecution: false },
        { Name: 'ScreenPixelsWidth', Type: 'Int32', Category: 'Screen', DelayExecution: false },
        { Name: 'ScreenPixelsHeight', Type: 'Int32', Category: 'Screen', DelayExecution: false },
        { Name: 'JavascriptHardwareProfile', Type: 'JavaScript', Category: 'Javascript', DelayExecution: false }]
    }
  }
};

const defaultKeys = [
  'header.User-Agent',
  'query.User-Agent',
  'cookie.51D_JavascriptHardwareProfile',
  'query.51D_JavascriptHardwareProfile',
  'query.51D_ProfileIds',
  'cookie.51D_ProfileIds'
];

const defaultJson = {
  device: {
    ismobile: false,
    screenpixelswidth: 0,
    screenpixelsheight: 0,
    javascripthardwareprofile: null,
    javascripthardwareprofilenullreason: null
  },
  javascriptProperties: [
    'device.javascripthardwareprofile'
  ]
};

class MockRequestClient {
  constructor ({
    properties = defaultProperties,
    json = defaultJson,
    keys = defaultKeys,
    error
  } = {}) {
    this.properties = properties;
    this.json = json;
    this.keys = keys;
    this.error = error;
  }

  post (url, headers, data) {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (self.error) {
        reject(self.error);
      }
      if (url.toLowerCase().includes('json')) {
        resolve(JSON.stringify(self.json));
      } else {
        reject('unexpected URL ' + url); // eslint-disable-line
      }
    });
  }

  get (url, origin) {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (self.error) {
        reject(self.error);
      }
      if (url.toLowerCase().includes('accessibleproperties')) {
        resolve(JSON.stringify(self.properties));
      } else if (url.toLowerCase().includes('evidencekeys')) {
        resolve(JSON.stringify(self.keys));
      } else {
        reject('unexpected URL ' + url); // eslint-disable-line
      }
    });
  }
}

module.exports = MockRequestClient;
