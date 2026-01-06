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

const path = require('path');
const http = require('http');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const CloudRequestError = require('../cloudRequestError');

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const pipelineBuilderPath = path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder');
const PipelineBuilder = require(pipelineBuilderPath);

// Invalid resource key
const testResourceKey = 'AAAAAAAAAAAA';

/**
 * Test cloud request engine adds correct information to post request
 * and returns the response in the ElementData
 */
test('process', done => {
  const jsonResponse = { device: { value: 51 } };
  const client = new MockRequestClient({ json: jsonResponse });
  const engine = new CloudRequestEngine({
    resourceKey: testResourceKey,
    requestClient: client
  });

  const pipeline = new PipelineBuilder()
    .add(engine)
    .build();

  const data = pipeline.createFlowData();

  data.process().then((processedData) => {
    const result = processedData.getFromElement(engine).cloud;

    expect(result).toBe(JSON.stringify(jsonResponse));

    const jsonObj = JSON.parse(result);
    expect(jsonObj.device.value).toBe(51);
    done();
  });
});

/**
 * Verify that the CloudRequestEngine can correctly parse a
 * response from the accessible properties endpoint that contains
 * meta-data for sub-properties.
 */
test('sub properties', () => {
  const properties = {
    Products: {
      device: {
        DataTier: 'CloudV4TAC',
        Properties: [
          {
            Name: 'IsMobile',
            Type: 'Boolean',
            Category: 'Device'
          },
          {
            Name: 'IsTablet',
            Type: 'Boolean',
            Category: 'Device'
          }
        ]
      },
      devices: {
        DataTier: 'CloudV4TAC',
        Properties: [
          {
            Name: 'Devices',
            Type: 'Array',
            Category: 'Unspecified',
            ItemProperties: [
              {
                Name: 'IsMobile',
                Type: 'Boolean',
                Category: 'Device'
              },
              {
                Name: 'IsTablet',
                Type: 'Boolean',
                Category: 'Device'
              }
            ]
          }
        ]
      }
    }
  };
  const client = new MockRequestClient({ properties });
  const engine = new CloudRequestEngine({
    resourceKey: testResourceKey,
    requestClient: client
  });
  return engine.ready().then(engine => {
    expect(Object.entries(engine.flowElementProperties).length).toBe(2);
    const deviceProperties = engine.flowElementProperties.device;
    expect(Object.entries(deviceProperties).length).toBe(2);
    propertiesContainName(deviceProperties, 'IsMobile');
    propertiesContainName(deviceProperties, 'IsTablet');
    const devicesProperties = engine.flowElementProperties.devices;
    expect(devicesProperties).not.toBeUndefined();
    expect(devicesProperties).not.toBeNull();
    expect(Object.entries(devicesProperties).length).toBe(1);
    propertiesContainName(devicesProperties.devices.itemproperties, 'IsMobile');
    propertiesContainName(devicesProperties.devices.itemproperties, 'IsTablet');
  });
});

/**
 * Test cloud request engine handles JSON errors from the cloud service
 * as expected.
 * An exception should be thrown by the cloud request engine
 * containing the errors from the cloud service in the JSON object.
 */
test('validate error handling JSON errors', async () => {
  const errorMessage = 'an error message returned by the cloud service';
  const client = new MockRequestClient({
    resourceKey: 'resourceKey',
    error: '{ "status":"400", "errors": ["' + errorMessage + '"] }'
  });

  const e = () => {
    return new CloudRequestEngine({
      resourceKey: testResourceKey,
      requestClient: client
    }).ready();
  };
  await expect(e()).rejects.toEqual([new CloudRequestError(errorMessage)]);
});

/**
 * Test cloud request engine handles unavailability of cloud service
 * as expected.
 * An exception should be thrown by the cloud request engine
 * containing the errors from the cloud service in the JSON object.
 */

test('validate case when cloud unavailable', (done) => {
  const SERVER_PORT = 3000;
  const errorMessage = 'Cloud server internal error';

  const server = http.createServer((req, res) => {
    const client = new MockRequestClient({
      resourceKey: 'resourceKey',
      error: '{ "status":"500", "errors": ["' + errorMessage + '"] }'
    });

    const requestEngine = new CloudRequestEngine({
      resourceKey: testResourceKey,
      requestClient: client
    });

    requestEngine.ready().then(engine => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(engine.device));
    }).catch(error => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(error));
    });
  }).listen(SERVER_PORT, () => {
    const options = {
      hostname: 'localhost',
      port: SERVER_PORT,
      path: '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let response = '';

      res.on('data', (chunk) => {
        response += chunk;
      });

      res.on('end', () => {
        const error = JSON.parse(response)[0];
        expect(error.errorMessage).toBe(errorMessage);
        expect(error.name).toBe('CloudRequestError');
        server.close(); // Close the server after the request is complete.
        done();
      });
    });
    req.end();
  });
});

/**
 *  Check if Properties contains name
 *
 * @param {object} properties Object of properties
 * @param {string} name Name of the property
 */
function propertiesContainName (properties, name) {
  expect(properties[name.toLowerCase()]).not.toBeUndefined();
  expect(properties[name.toLowerCase()]).not.toBeNull();
  expect(properties[name.toLowerCase()].name).toBe(name);
}
