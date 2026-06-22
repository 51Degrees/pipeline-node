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

const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));

// Don't add the JavaScript / SetHeaders elements so the pipelines below
// are built from an empty element list (no external data required).
const minimalSettings = {
  addJavaScriptBuilder: false,
  useSetHeaderProperties: false
};

test('defaults to false when not specified (build)', () => {
  const pipeline = new PipelineBuilder(minimalSettings).build();
  expect(pipeline.suppressProcessExceptions).toBe(false);
});

test('builder option flows through to the pipeline (build)', () => {
  const pipeline = new PipelineBuilder(
    Object.assign({ suppressProcessExceptions: true }, minimalSettings)
  ).build();
  expect(pipeline.suppressProcessExceptions).toBe(true);
});

test('defaults to false from configuration when not specified', () => {
  const config = { PipelineOptions: { Elements: [] } };
  const pipeline = new PipelineBuilder(minimalSettings)
    .buildFromConfiguration(config);
  expect(pipeline.suppressProcessExceptions).toBe(false);
});

test('read from PipelineOptions.BuildParameters (cross-language layout)', () => {
  const config = {
    PipelineOptions: {
      Elements: [],
      BuildParameters: { suppressProcessExceptions: true }
    }
  };
  const pipeline = new PipelineBuilder(minimalSettings)
    .buildFromConfiguration(config);
  expect(pipeline.suppressProcessExceptions).toBe(true);
});

test('read from a direct PipelineOptions.suppressProcessExceptions key', () => {
  const config = {
    PipelineOptions: { Elements: [], suppressProcessExceptions: true }
  };
  const pipeline = new PipelineBuilder(minimalSettings)
    .buildFromConfiguration(config);
  expect(pipeline.suppressProcessExceptions).toBe(true);
});

test('BuildParameters takes precedence over the direct key', () => {
  const config = {
    PipelineOptions: {
      Elements: [],
      suppressProcessExceptions: false,
      BuildParameters: { suppressProcessExceptions: true }
    }
  };
  const pipeline = new PipelineBuilder(minimalSettings)
    .buildFromConfiguration(config);
  expect(pipeline.suppressProcessExceptions).toBe(true);
});
