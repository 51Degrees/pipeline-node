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

const core = require('fiftyone.pipeline.core');

const testEngine = new core.FlowElement({
  dataKey: 'testengine',
  properties: {
    one: {
      type: 'int'
    },
    two: {
      type: 'int'
    },
    three: {
      type: 'javascript'
    },
    four: {
      type: 'string'
    }
  },
  processInternal: function (flowData) {
    const contents = { one: 1, two: 2 };

    const three = new core.AspectPropertyValue();
    three.value = "console.log('ok')";

    contents.three = three;

    contents.four = new core.AspectPropertyValue(
      'This property is not available'
    );

    const data = new core.ElementDataDictionary({
      flowElement: this,
      contents
    });

    flowData.setElementData(data);
  }
});

const pipeline = new core.PipelineBuilder()
  .add(testEngine)
  .build();

const flowData = pipeline.createFlowData();

test('jsonbuilder contents', done => {
  flowData.process().then(function () {
    const json = JSON.stringify(flowData.jsonbundler.json);

    expect(json).toBe(
      JSON.stringify({
        javascriptProperties: ['testengine.three'],
        testengine: {
          one: 1,
          two: 2,
          three: "console.log('ok')",
          four: null,
          fournullreason: 'This property is not available'
        }
      })
    );

    done();
  });
});

test('sequence gives a session id', () => {
  expect(flowData.evidence.get('query.session-id')).toBeTruthy();
});

test('sequence gives a sequence number', () => {
  expect(flowData.evidence.get('query.sequence')).toBe(1);
});

const flowData2 = pipeline.createFlowData();

flowData2.evidence.add('query.session-id', 'test');
flowData2.evidence.add('query.sequence', 10);

test('sequence number for same session id increments', (done) => {
  flowData2.process().then(function () {
    expect(flowData2.evidence.get('query.sequence')).toBe(11);

    done();
  });
});

test('no javascriptProperties when sequence cap met', () => {
  expect(flowData2.jsonbundler.json.javascriptProperties.length).toBe(0);
});

// The script appends the session id and the sequence to its own request,
// after taking the record of that request's inputs. That record decides
// whether a later page view in the same tab can be served from the cached
// response, and a session id is different on every page view, so one named
// in the parameters would put a value in the record that can never match.
// The cache would be thrown away and the snippets would run again on every
// page.
//
// The parameters are only rendered when the builder has somewhere to send
// its request, so this pipeline gives it one.
const parameterPipeline = new core.PipelineBuilder({
  javascriptBuilderSettings: {
    host: 'localhost',
    protocol: 'https',
    endPoint: '/json'
  }
})
  .add(testEngine)
  .build();

const flowData3 = parameterPipeline.createFlowData();

flowData3.evidence.add('query.session-id', 'test-session');
flowData3.evidence.add('query.sequence', 1);
flowData3.evidence.add('query.mark', 'kept');

test('the script parameters leave out the session id and the sequence',
  (done) => {
    flowData3.process().then(function () {
      const script = flowData3.javascriptbuilder.javascript;
      // The one line that assigns the parameters object. The template has
      // called it both "parameters" and "renderedParameters", so naming
      // either would make this pass or fail on which revision of the
      // template is embedded rather than on anything the builder does. The
      // line that assigns it mentions parameters and has a brace; the line
      // that merely calls it has no brace.
      const declaration = script.split(/\r?\n/)
        .filter(line => /parameters\s*=/i.test(line) && line.includes('{'));

      expect(declaration.length).toBe(1);
      expect(declaration[0]).not.toContain('session-id');
      expect(declaration[0]).not.toContain('sequence');
      // Present, or this would pass with no parameters at all.
      expect(declaration[0]).toContain('kept');

      done();
    });
  });

test('JSON bundler - Verify output where delayed execution = false', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        delayexecution: false,
        type: 'javascript'
      },
      two: {
        evidenceproperties: ['jsontestengine']
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({ one: 1, two: 2 });
    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

test('JSON bundler - Verify output where delayed execution = true', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        delayexecution: true,
        type: 'javascript'
      },
      two: {
        evidenceproperties: ['one']
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({
      onedelayexecution: true,
      one: 1,
      twoevidenceproperties: ['jsontestengine.one'],
      two: 2
    });
    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

test('JSON bundler - Verify output where a property has multiple evidence properties', (done) => {
  const delayExecutionEngine1 = new core.FlowElement({
    dataKey: 'jsontestengine',
    properties: {
      one: {
        evidenceproperties: ['two', 'three']
      },
      two: {
        delayexecution: true
      },
      three: {
        delayexecution: false
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2, three: 3 };

      const data = new core.ElementDataDictionary({
        flowElement: this,
        contents
      });

      flowData.setElementData(data);
    }
  });

  const delayExecutionpipeline1 = new core.PipelineBuilder()
    .add(delayExecutionEngine1)
    .build();

  const delayExecutionflowData = delayExecutionpipeline1.createFlowData();

  delayExecutionflowData.process().then(function () {
    const expected = JSON.stringify({
      oneevidenceproperties: ['jsontestengine.two'],
      one: 1,
      twodelayexecution: true,
      two: 2,
      three: 3
    });

    const actual = JSON.stringify(delayExecutionflowData.jsonbundler.json.jsontestengine);
    expect(actual).toBe(expected);
    done();
  });
});

// Check that the addJavaScriptBuilder option is honoured
test('JavaScriptBuilder - Verify minify default setting', (done) => {
  const noJsPipelineBuilder = new core.PipelineBuilder({
    addJavaScriptBuilder: false
  });

  expect(noJsPipelineBuilder.addJavaScriptBuilder).toBe(false);

  done();
});

// Check that the default setting of minify is false
test('JavaScriptBuilder - Verify minify default setting', (done) => {
  expect(flowData.pipeline.flowElements.javascriptbuilder.settings.minify)
    .toBe(false);

  done();
});

// The builders for every language render the same script, and the .NET
// builder is the reference. These tests pin the parts of the script that
// depend on the request, being the callback URL and the parameters object.

// Renders the script for the given evidence and builder settings.
const renderScript = async (settings, evidence) => {
  const renderPipeline = new core.PipelineBuilder({
    javascriptBuilderSettings: settings
  })
    .add(testEngine)
    .build();
  const renderData = renderPipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    renderData.evidence.add(key, value);
  }
  await renderData.process();
  return renderData.javascriptbuilder.javascript;
};

// The URLs the script sends its request to. The template writes the URL
// into a fetch call or an XMLHttpRequest, depending on the browser.
const requestUrls = (script) => {
  const urls = [];
  const pattern = /(?:fetch\(|createCORSRequest\('POST',\s*)'([^']*)'/g;
  let match;
  while ((match = pattern.exec(script)) !== null) {
    urls.push(match[1]);
  }
  return urls;
};

// The object literal the rendered parameters function returns.
const renderedParameters = (script) => {
  const line = script.split(/\r?\n/)
    .find(l => /parameters\s*=/i.test(l) && l.includes('{'));
  const match = /return\s+(\{.*\});\s*\};/.exec(line);
  return JSON.parse(match[1]);
};

const requestEvidence = {
  'header.host': 'localhost',
  'header.protocol': 'https',
  'query.user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'query.client-ip': '192.0.2.1',
  'query.session-id': 'test-session',
  'query.sequence': 1
};

// The request goes to the endpoint alone. The values the page was requested
// with travel in the request body, so none of them, and in particular not
// the visitor's User-Agent or address, are written into the URL.
test('the request URL is the protocol, host and endpoint only', async () => {
  const script = await renderScript({ endPoint: '/json' }, requestEvidence);
  const urls = requestUrls(script);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).toBe('https://localhost/json');
  }
});

// One slash between the host and the endpoint, whichever of them carries it.
test.each([
  ['no slash on either', 'localhost', 'json'],
  ['slash on the host', 'localhost/', 'json'],
  ['slash on both', 'localhost/', '/json'],
  ['slash on the endpoint', 'localhost', '/json']
])('the request URL has one slash - %s', async (name, host, endPoint) => {
  const script = await renderScript(
    { host, protocol: 'https', endPoint },
    {});
  const urls = requestUrls(script);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url).toBe('https://localhost/json');
  }
});

// Names and values are encoded as the .NET builder encodes them, because
// the script joins them into the request body as they stand.
test('the parameters are encoded', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'query.user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'query.a b': "x~'y&z=1"
  });
  expect(renderedParameters(script)).toStrictEqual({
    'user-agent': 'Mozilla%2F5.0+(Windows+NT+10.0%3B+Win64%3B+x64)',
    'a+b': 'x%7E%27y%26z%3D1'
  });
});

// A name is everything after the first dot of the evidence key, so a name
// that itself contains a dot, such as id.usage, is kept whole.
test('a parameter name keeps every part after the prefix', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'query.id.usage': 'standard'
  });
  expect(renderedParameters(script)).toStrictEqual({
    'id.usage': 'standard'
  });
});

// Only query evidence becomes a parameter. A header whose name happens to
// contain the word query is not one.
test('only query evidence becomes a parameter', async () => {
  const script = await renderScript({ endPoint: '/json' }, {
    'header.host': 'localhost',
    'header.x-query': 'header value',
    'query.mark': 'kept'
  });
  expect(renderedParameters(script)).toStrictEqual({ mark: 'kept' });
});
