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
      // The one line that assigns the parameters object. It is named
      // differently across template versions, so it is found by the
      // assignment rather than by the name.
      const declaration = script.split(/\r?\n/)
        .filter(line => /parameters = {/.test(line));

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
