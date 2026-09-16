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

// Checks that the client side object can be given a different name, from
// the builder's options and from the page request's evidence, and that a
// name which is not a valid JavaScript identifier is never written into the
// script. The rendered script is parsed, and then run against a minimal
// stand in for the browser, so no browser is needed.

const vm = require('vm');
const core = require('fiftyone.pipeline.core');

const objectNameKey = core.Constants.evidenceObjectName;

// An element whose values appear in the script's payload as device.ismobile,
// so the test can read a value back through the renamed object.
const deviceElement = new core.FlowElement({
  dataKey: 'device',
  properties: {
    ismobile: {
      type: 'bool'
    }
  },
  processInternal: function (flowData) {
    const data = new core.ElementDataDictionary({
      flowElement: this,
      contents: { ismobile: true }
    });
    flowData.setElementData(data);
  }
});

/**
 * Builds a pipeline, processes it with the evidence given and returns the
 * rendered script along with any warnings the pipeline logged.
 *
 * @param {object} builderSettings options for the JavaScript builder
 * @param {object} evidence evidence to add before processing
 * @returns {Promise<{script: string, warnings: Array}>} the script
 */
async function render (builderSettings, evidence) {
  const pipeline = new core.PipelineBuilder({
    javascriptBuilderSettings: builderSettings
  })
    .add(deviceElement)
    .build();
  const warnings = [];
  pipeline.on('warn', message => warnings.push(message));
  const flowData = pipeline.createFlowData();
  for (const key in evidence) {
    flowData.evidence.add(key, evidence[key]);
  }
  await flowData.process();
  return { script: flowData.javascriptbuilder.javascript, warnings };
}

/**
 * Parses the script as a classic script without running it, which is how a
 * browser loads it. Throws a SyntaxError if it does not parse.
 *
 * @param {string} script the rendered script
 */
function parse (script) {
  // eslint-disable-next-line no-new
  new vm.Script(script, { filename: 'JavaScriptResource.js' });
}

/**
 * Runs the script in a new context holding only a minimal window, document
 * and session storage, and returns that context, which is also the window.
 *
 * @param {string} script the rendered script
 * @returns {object} the global object the script ran in
 */
function run (script) {
  const stored = {};
  const sessionStorage = {
    get length () { return Object.keys(stored).length; },
    key: i => Object.keys(stored)[i] ?? null,
    getItem: k => (k in stored ? stored[k] : null),
    setItem: (k, v) => { stored[k] = String(v); },
    removeItem: k => { delete stored[k]; }
  };
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    document: { cookie: '' },
    sessionStorage,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const context = vm.createContext(sandbox);
  // The script refers to the global object as window, as it is in a browser,
  // so a top level var is also a property of window.
  context.window = context;
  vm.runInContext(script, context, { filename: 'JavaScriptResource.js' });
  return context;
}

/**
 * Asserts that the script uses the name given everywhere the name is
 * written, that it parses, and that the object works once the script has
 * run.
 *
 * @param {string} script the rendered script
 * @param {string} name the name the object is expected to have
 */
function expectWorkingObject (script, name) {
  expect(script).toMatch(new RegExp('var ' + name + ' = new ' +
    'fiftyoneDegreesManager\\(\\);'));
  if (name !== 'fod') {
    expect(script).not.toMatch(/var fod\b/);
  }
  expect(script).toContain('var sessionKey = "' + name + '";');
  expect(script).toContain('window["' + name + 'Evidence"]');

  expect(() => parse(script)).not.toThrow();

  const window = run(script);
  const obj = window[name];
  expect(obj).toBeDefined();
  expect(typeof obj.complete).toBe('function');
  expect(typeof obj.onChange).toBe('function');
  expect(typeof obj.refresh).toBe('function');
  expect(obj.device.ismobile).toBe(true);
}

describe('JavaScript builder object name', () => {
  test('a name set in the options is used throughout the script',
    async () => {
      const { script } = await render({ objName: 'myFod' }, {});
      expectWorkingObject(script, 'myFod');
    });

  test('a name given in evidence is used throughout the script',
    async () => {
      const { script, warnings } = await render({}, {
        [objectNameKey]: 'myFod'
      });
      expectWorkingObject(script, 'myFod');
      expect(warnings).toEqual([]);
    });

  // The last argument is text that would only be in the script if the
  // requested name had been written into it. Mustache escapes quotes and
  // slashes, so the escaped forms are listed as well as the raw ones.
  test.each([
    ['a separator', 'a;b//', ['a;b', 'var a;']],
    ['a leading digit', '9bad', ['9bad']],
    ['a quote', 'x"y', ['x"y', 'x&quot;y', 'var x&', 'var x"']],
    ['nothing', '', ['var  =']],
    ['a reserved word', 'class', ['var class']]
  ])('a name in evidence with %s is ignored with a warning',
    async (description, name, absent) => {
      const { script, warnings } = await render({}, {
        [objectNameKey]: name
      });
      expectWorkingObject(script, 'fod');
      for (const text of absent) {
        expect(script).not.toContain(text);
      }
      expect(script.match(/new fiftyoneDegreesManager\(\)/g).length)
        .toBe(1);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('not a valid JavaScript identifier');
    });

  test('an invalid name in evidence falls back to the configured name',
    async () => {
      const { script } = await render({ objName: 'myFod' }, {
        [objectNameKey]: '9bad'
      });
      expectWorkingObject(script, 'myFod');
      expect(script).not.toContain('9bad');
    });

  test.each([
    ['a separator', 'a;b'],
    ['a leading digit', '9bad'],
    ['a quote', 'x"y'],
    ['nothing', ''],
    ['a reserved word', 'var'],
    ['a value that is not a string', 5]
  ])('a configured name with %s is refused', (description, name) => {
    expect(() => new core.JavascriptBuilder({ objName: name }))
      .toThrow('objName is invalid');
  });
});
