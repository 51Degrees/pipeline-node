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
const path = require('path');

const setup = require(path.resolve(__dirname, 'coreTestSetup.js'));
const PipelineBuilder = require('../pipelineBuilder');
const Helpers = require('../helpers');
const each = require('jest-each').default;
const AspectPropertyValue = require('../aspectPropertyValue');
const httpMocks = require('node-mocks-http');

const unknownValue = new AspectPropertyValue(null, 'Unknown');
const testValue = new AspectPropertyValue(null, 'test');
const browserValue = new AspectPropertyValue(null, 'SEC-CH-UA,SEC-CH-UA-Full-Version');
const platformValue = new AspectPropertyValue(null, 'SEC-CH-UA-Platform,SEC-CH-UA-Platform-Version');
const hardwareValue = new AspectPropertyValue(null, 'SEC-CH-UA-Model,SEC-CH-UA-Mobile,SEC-CH-UA-Arch');
// Value which contains at least one duplicate value from each of other SetHeader values.
const duplicateValue = new AspectPropertyValue(null, 'SEC-CH-UA,SEC-CH-UA-Platform,SEC-CH-UA-Model');

// Set up the properties in the element.
setup.device.properties['SetHeaderBrowserAccept-CH'] = {
  name: 'SetHeaderBrowserAccept-CH'
};
setup.device.properties['SetHeaderPlatformAccept-CH'] = {
  name: 'SetHeaderPlatformAccept-CH'
};
setup.device.properties['SetHeaderHardwareAccept-CH'] = {
  name: 'SetHeaderHardwareAccept-CH'
};
setup.device.properties.SetHeaderHardwareSomeOtherHeader = {
  name: 'SetHeaderHardwareSomeOtherHeader'
};

const pipeline = new PipelineBuilder()
  .add(setup.device)
  .build();

/**
 * Test response header value to be set for UACH
 *
 */
each([
  ['Ignore all unknown values.',
    { 'SetHeaderBrowserAccept-CH': unknownValue, 'SetHeaderPlatformAccept-CH': unknownValue, 'SetHeaderHardwareAccept-CH': unknownValue },
    { 'Accept-CH': 'nil' }],
  ['Ignore unknown values.',
    { 'SetHeaderBrowserAccept-CH': unknownValue, 'SetHeaderPlatformAccept-CH': unknownValue, 'SetHeaderHardwareAccept-CH': testValue },
    { 'Accept-CH': 'test' }],
  ['Single property, single header.',
    { 'SetHeaderBrowserAccept-CH': browserValue },
    { 'Accept-CH': 'SEC-CH-UA,SEC-CH-UA-Full-Version' }],
  ['Two properties, single header.',
    { 'SetHeaderPlatformAccept-CH': platformValue, 'SetHeaderHardwareAccept-CH': hardwareValue },
    { 'Accept-CH': 'SEC-CH-UA-Platform,SEC-CH-UA-Platform-Version,SEC-CH-UA-Model,SEC-CH-UA-Mobile,SEC-CH-UA-Arch' }],
  ['Multiple properties, single header.',
    { 'SetHeaderBrowserAccept-CH': browserValue, 'SetHeaderPlatformAccept-CH': platformValue, 'SetHeaderHardwareAccept-CH': hardwareValue },
    { 'Accept-CH': 'SEC-CH-UA,SEC-CH-UA-Full-Version,SEC-CH-UA-Platform,SEC-CH-UA-Platform-Version,SEC-CH-UA-Model,SEC-CH-UA-Mobile,SEC-CH-UA-Arch' }],
  ['String value (not aspectproperty).',
    { 'SetHeaderBrowserAccept-CH': browserValue.value },
    { 'Accept-CH': browserValue.value }],
  ['Undefined value.',
    { 'SetHeaderBrowserAccept-CH': undefined },
    { 'Accept-CH': 'nil' }],
  ['Set multiple headers.',
    { 'SetHeaderBrowserAccept-CH': browserValue, SetHeaderHardwareSomeOtherHeader: platformValue },
    { 'Accept-CH': browserValue.value, SomeOtherHeader: platformValue.value }],
  ['Properties with duplicate values.',
    { 'SetHeaderPlatformAccept-CH': platformValue, 'SetHeaderHardwareAccept-CH': duplicateValue },
    { 'Accept-CH': 'SEC-CH-UA-Platform,SEC-CH-UA-Platform-Version,SEC-CH-UA,SEC-CH-UA-Model' }]
])
  .test('testGetResponseHeaderValue - %s', async (name, device, expectedHeaders) => {
  // Set up a mock repsonse object to collect the headers which are
  // added to it.
    const response = httpMocks.createResponse();
    setup.device.additionalValues = device;
    const flowData = pipeline.createFlowData();
    const result = await flowData.process();
    // Call the method.
    Helpers.setResponseHeaders(response, result);
    // Check the correct headers were added to the response.
    for (const [key, value] of Object.entries(expectedHeaders)) {
      if (value === 'nil') {
        expect(response.getHeader('Accept-CH')).toBe(undefined);
      } else {
        expect(response.getHeader(key)).toBe(value);
      }
    }
  });

test('testGetResponseHeaderValue - append to existing header', async () => {
  // Set up a mock repsonse object to collect the headers which are
  // added to it.
  const response = httpMocks.createResponse();
  response.setHeader('Accept-CH', 'existing');
  setup.device.additionalValues = { 'SetHeaderBrowserAccept-CH': browserValue };
  const flowData = pipeline.createFlowData();
  const result = await flowData.process();
  // Call the method.
  Helpers.setResponseHeaders(response, result);
  // Check the correct headers were added to the response.
  expect(response.getHeader('Accept-CH')).toBe(`existing,${browserValue.value}`);
});
