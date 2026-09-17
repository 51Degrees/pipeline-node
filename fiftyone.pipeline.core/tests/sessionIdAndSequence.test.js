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

// Checks the session id and the sequence the builder writes into the
// script. The session id is written inside double quotes and the sequence
// as a number, so a value that could break the script is replaced, with an
// empty session id or a sequence of 1. Each script is parsed, which is what
// a browser does when it loads one, so no browser is needed.

const vm = require('vm');
const core = require('fiftyone.pipeline.core');

const sessionIdKey = 'query.session-id';
const sequenceKey = 'query.sequence';

const sessionIdLine = /var sessionId = "(.*)";/g;
const sequenceLine = /var sequence = (.*);/g;

const longestValidSessionId = 'a'.repeat(64);

// Values that must never be written into the script. The last is 65
// characters, one more than the longest that is allowed.
const invalidSessionIds = [
  ['a quote', 'a"b'],
  ['a backslash', 'a\\b'],
  ['a closing tag', '</script>'],
  ['a non-ASCII character', 'caf\u00e9'],
  ['too many characters', 'a'.repeat(65)]
];

/**
 * Builds a pipeline with or without the Sequence Element, processes it with
 * the evidence given, checks the script parses and returns it. The pipeline
 * without the Sequence Element still has the JSON bundler, so the payload is
 * built the same way, and the evidence reaches the builder as it was given.
 *
 * @param {boolean} sequenceElement whether to add the Sequence Element
 * @param {object} evidence evidence to add before processing
 * @returns {Promise<string>} the rendered script
 */
async function render (sequenceElement, evidence) {
  let pipeline;
  if (sequenceElement) {
    pipeline = new core.PipelineBuilder().build();
  } else {
    pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
      .add(new core.JsonBundler())
      .add(new core.JavascriptBuilder({}))
      .build();
  }
  const flowData = pipeline.createFlowData();
  for (const key in evidence) {
    flowData.evidence.add(key, evidence[key]);
  }
  await flowData.process();
  const script = flowData.javascriptbuilder.javascript;
  // eslint-disable-next-line no-new
  expect(() => new vm.Script(script, { filename: 'JavaScriptResource.js' }))
    .not.toThrow();
  return script;
}

/**
 * The single value the script gives a variable, which fails the test where
 * the script gives it none or more than one.
 *
 * @param {RegExp} pattern the line that assigns the variable
 * @param {string} script the rendered script
 * @returns {string} the value as it is written in the script
 */
function value (pattern, script) {
  const matches = [...script.matchAll(pattern)];
  expect(matches.length).toBe(1);
  return matches[0][1];
}

const sessionId = script => value(sessionIdLine, script);
const sequence = script => value(sequenceLine, script);

describe('session id and sequence', () => {
  test('a session id of letters, digits and hyphens is written',
    async () => {
      const script = await render(false, { [sessionIdKey]: 'abc-123' });
      expect(sessionId(script)).toBe('abc-123');
      expect(sequence(script)).toBe('1');
    });

  test('the longest allowed session id is written', async () => {
    const script = await render(false, {
      [sessionIdKey]: longestValidSessionId
    });
    expect(sessionId(script)).toBe(longestValidSessionId);
  });

  test.each(invalidSessionIds)(
    'a session id with %s is written as an empty string',
    async (description, id) => {
      const script = await render(false, { [sessionIdKey]: id });
      expect(sessionId(script)).toBe('');
    });

  // The Sequence Element keeps a session id that is already in the
  // evidence, so an invalid one reaches the builder that way too.
  test.each(invalidSessionIds)(
    'a session id with %s is written as an empty string with the ' +
    'Sequence Element',
    async (description, id) => {
      const script = await render(true, { [sessionIdKey]: id });
      expect(sessionId(script)).toBe('');
    });

  test('the session id the Sequence Element creates is written',
    async () => {
      const script = await render(true, {});
      expect(sessionId(script)).toMatch(/^[A-Za-z0-9-]{1,64}$/);
      expect(sequence(script)).toBe('1');
    });

  test('with no Sequence Element and no evidence the script still has a ' +
    'sequence', async () => {
    const script = await render(false, {});
    expect(sessionId(script)).toBe('');
    expect(sequence(script)).toBe('1');
  });

  // A sequence from a web request is text. With no Sequence Element it
  // reaches the builder as it is.
  test.each(['abc', '-1', '0', '99999999999', '', '2147483648'])(
    'a sequence of "%s" is written as 1',
    async (given) => {
      const script = await render(false, {
        [sessionIdKey]: 'abc-123',
        [sequenceKey]: given
      });
      expect(sequence(script)).toBe('1');
    });

  test.each([-1, 0, 1.5, 99999999999, NaN])(
    'a sequence number of %s is written as 1',
    async (given) => {
      const script = await render(false, {
        [sessionIdKey]: 'abc-123',
        [sequenceKey]: given
      });
      expect(sequence(script)).toBe('1');
    });

  test.each([[5, '5'], ['5', '5'], [2147483647, '2147483647'],
    ['2147483647', '2147483647']])(
    'a sequence of %s is written as %s',
    async (given, expected) => {
      const script = await render(false, {
        [sessionIdKey]: 'abc-123',
        [sequenceKey]: given
      });
      expect(sequence(script)).toBe(expected);
    });

  // The Sequence Element adds one to the sequence before the builder sees
  // it, and reads text with parseInt, so text that is not a number reaches
  // the builder as NaN and a number below zero reaches it below one.
  test.each([['abc', '1'], ['-2', '1'], ['0', '1'], ['99999999999', '1'],
    ['5', '6']])(
    'a sequence of "%s" with the Sequence Element is written as %s',
    async (given, expected) => {
      const script = await render(true, {
        [sessionIdKey]: 'abc-123',
        [sequenceKey]: given
      });
      expect(sequence(script)).toBe(expected);
    });
});
