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

const core = require('fiftyone.pipeline.core');
const each = require('jest-each').default;

const cookieElement = new core.FlowElement({
  dataKey: 'cookie',
  properties: {
    javascript: {
      type: 'javascript'
    }
  },

  processInternal: function (flowData) {
    const contents = { javascript: 'document.cookie =  "some cookie value"' };

    const data = new core.ElementDataDictionary({
      flowElement: this,
      contents
    });

    flowData.setElementData(data);
  }

});

const sequenceElement = new core.SequenceElement();
const jsonElement = new core.JsonBundler();
each([
  [false, false, false],
  [true, false, false],
  [false, true, true],
  [true, true, true]
])
  .test('JavaScript cookies', (enableInConfig, enableInEvidence, expectCookie, done) => {
    const jsElement = new core.JavascriptBuilder({ enableCookies: enableInConfig });

    const pipeline = new core.PipelineBuilder()
      .add(cookieElement)
      .add(sequenceElement)
      .add(jsonElement)
      .add(jsElement)
      .build();

    const flowData = pipeline.createFlowData();
    flowData.evidence.add(core.Constants.evidenceEnableCookies, enableInEvidence.toString());
    flowData.process().then(function () {
      const js = flowData.javascriptbuilder.javascript;
      const matches = [...js.matchAll(/document\.cookie/g)];
      if (expectCookie) {
        expect(matches.length).toBe(2);
      } else {
        expect(matches.length).toBe(1);
      }
      done();
    });
  });
