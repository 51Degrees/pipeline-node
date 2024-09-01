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

const syncPipeline = new PipelineBuilder()
  .add(setup.async)
  .add(setup.sync)
  .build();

const syncFlowData = syncPipeline.createFlowData();

syncFlowData.evidence.add('header.user_agent', 'test');
syncFlowData.evidence.add('header.other', 'no');
syncFlowData.evidence.addObject({ test: 'testing' });

/**
 * Check that a value that has been added to the evidence
 * collection can be retrieved.
 */
test('evidence add', () => {
  expect(syncFlowData.evidence.get('header.user_agent')).toBe('test');
});

/**
 * Check that a value that has been added to the evidence
 * collection using the 'addObject' function can be retrieved.
 */
test('evidence addObject', () => {
  expect(syncFlowData.evidence.get('test')).toBe('testing');
});

/**
 * Check that a value that the evidenceKeyFilter works
 * as expected.
 * In this case, the element only wants header.user_agent
 * so this is the only key that is returned, even though
 * other evidence values are present.
 */
test('evidenceKeyFilter', () => {
  const allEvidence = syncFlowData.evidence.getAll();

  expect(Object.keys(
    setup.sync.evidenceKeyFilter.filterEvidence(allEvidence))[0]
  )
    .toBe('header.user_agent');
});

/**
 * Check that evidence addFromRequest
 * can correctly handle Incoming Request object */

test('evidence addFromRequest partial url', () => {
  const { EventEmitter } = require('events');

  // Mock request object
  const mockRequest = new EventEmitter();
  mockRequest.method = 'POST'; // Example HTTP method
  mockRequest.url = '/?some-value=some'; // Example request URL
  mockRequest.httpVersion = '1.1'; // Example HTTP version
  mockRequest.hostname = 'test.url';
  mockRequest.headers = {
    'Content-Type': 'application/json',
    'Content-Length': 18
  }; // Example request headers

  // Simulating request body data
  const mockBodyData = JSON.stringify({ evidence: 'sample' });
  mockRequest.emit('data', mockBodyData);
  mockRequest.emit('end');

  // Simulating connection object
  mockRequest.connection = {
    remoteAddress: '127.0.0.1',
    localAddress: '127.0.0.1'
  };

  expect(() => syncFlowData.evidence.addFromRequest(mockRequest)).not.toThrow();
  expect(syncFlowData.evidence.get('query.some-value')).toBe('some');
});

test('evidence addFromRequest full url', () => {
  const { EventEmitter } = require('events');

  // Mock request object
  const mockRequest = new EventEmitter();
  mockRequest.method = 'POST'; // Example HTTP method
  mockRequest.url = 'http://test.com/path?some-value=some'; // Example request URL
  mockRequest.httpVersion = '1.1'; // Example HTTP version
  mockRequest.hostname = 'test.url';
  mockRequest.headers = {
    'Content-Type': 'application/json',
    'Content-Length': 18
  }; // Example request headers

  // Simulating request body data
  const mockBodyData = JSON.stringify({ evidence: 'sample' });
  mockRequest.emit('data', mockBodyData);
  mockRequest.emit('end');

  // Simulating connection object
  mockRequest.connection = {
    remoteAddress: '127.0.0.1',
    localAddress: '127.0.0.1'
  };

  expect(() => syncFlowData.evidence.addFromRequest(mockRequest)).not.toThrow();
  expect(syncFlowData.evidence.get('query.some-value')).toBe('some');
});
