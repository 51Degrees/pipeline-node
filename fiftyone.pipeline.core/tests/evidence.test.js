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

// The client script sends its request as a POST with the values in a form
// body, being the page's parameters, the results of its snippets, the
// session id and the sequence. The .NET web integration adds form values as
// query evidence after the query string, so the Node one must as well, or
// none of those values reach the pipeline.
const { Readable } = require('stream');

// A pipeline whose elements keep query evidence.
const formPipeline = new PipelineBuilder().build();

// A request as Node's http module gives it, with the body as a stream.
const formRequest = (method, contentType, body, requestUrl) => {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  request.method = method;
  request.url = requestUrl || '/json?from-query=query&both=query';
  request.headers = { host: 'localhost' };
  if (contentType) {
    request.headers['content-type'] = contentType;
  }
  request.connection = {
    remoteAddress: '127.0.0.1',
    localAddress: '127.0.0.1'
  };
  return request;
};

const formBody = 'from-form=form&both=form&51D_ScreenPixelsWidth=1024' +
  '&session-id=abc&sequence=2&id.usage=standard&text=a+b%7E%27';

test('evidence addFromRequest reads a parsed form body', () => {
  const flowData = formPipeline.createFlowData();
  const request = formRequest(
    'POST', 'application/x-www-form-urlencoded', undefined);
  // As a framework's form parser leaves it.
  request.body = {
    'from-form': 'form',
    both: 'form',
    repeated: ['one', 'two']
  };
  flowData.evidence.addFromRequest(request);
  expect(flowData.evidence.get('query.from-query')).toBe('query');
  expect(flowData.evidence.get('query.from-form')).toBe('form');
  expect(flowData.evidence.get('query.both')).toBe('form');
  expect(flowData.evidence.get('query.repeated')).toBe('one,two');
});

test('evidence addFromRequest reads a form body given as text', () => {
  const flowData = formPipeline.createFlowData();
  const request = formRequest(
    'POST', 'application/x-www-form-urlencoded; charset=UTF-8', undefined);
  request.body = formBody;
  flowData.evidence.addFromRequest(request);
  expect(flowData.evidence.get('query.from-form')).toBe('form');
  expect(flowData.evidence.get('query.both')).toBe('form');
  expect(flowData.evidence.get('query.51D_ScreenPixelsWidth')).toBe('1024');
  expect(flowData.evidence.get('query.session-id')).toBe('abc');
  expect(flowData.evidence.get('query.sequence')).toBe('2');
  expect(flowData.evidence.get('query.id.usage')).toBe('standard');
  expect(flowData.evidence.get('query.text')).toBe("a b~'");
});

test('evidence addFromRequestAsync reads the form body from the stream',
  async () => {
    const flowData = formPipeline.createFlowData();
    const request = formRequest(
      'POST', 'application/x-www-form-urlencoded', formBody);
    const result = await flowData.evidence.addFromRequestAsync(request);
    expect(result).toBe(flowData.evidence);
    expect(flowData.evidence.get('query.from-query')).toBe('query');
    expect(flowData.evidence.get('query.from-form')).toBe('form');
    expect(flowData.evidence.get('query.both')).toBe('form');
    expect(flowData.evidence.get('query.51D_ScreenPixelsWidth'))
      .toBe('1024');
    expect(flowData.evidence.get('query.session-id')).toBe('abc');
    expect(flowData.evidence.get('query.sequence')).toBe('2');
  });

test.each([
  ['a GET request', 'GET', 'application/x-www-form-urlencoded'],
  ['a body that is not a form', 'POST', 'application/json'],
  ['a body with no content type', 'POST', undefined]
])('evidence addFromRequestAsync ignores the body of %s',
  async (name, method, contentType) => {
    const flowData = formPipeline.createFlowData();
    const request = formRequest(method, contentType, formBody);
    await flowData.evidence.addFromRequestAsync(request);
    expect(flowData.evidence.get('query.from-query')).toBe('query');
    expect(flowData.evidence.get('query.both')).toBe('query');
    expect(flowData.evidence.get('query.from-form')).toBeUndefined();
  });
