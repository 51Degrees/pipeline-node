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

const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const AspectPropertyValue = require('../aspectPropertyValue');

module.exports = {

  sync: new FlowElement({
    dataKey: 'sync',
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user_agent']),
    processInternal: function (flowData) {
      const contents = { integer: 5 };

      try {
        contents.boolean = flowData.get('async').get('string') === 'hello';
      } catch (e) {
        contents.boolean = false;
      }

      const data = new ElementDataDictionary(
        { flowElement: this, contents });

      flowData.setElementData(data);
    },
    properties: {
      integer: {
        type: 'int'
      },
      boolean: {
        type: 'bool'
      }
    }
  }),

  async: new FlowElement({
    dataKey: 'async',
    processInternal: function (flowData) {
      const flowElement = this;

      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          const contents = { string: 'hello' };

          const data = new ElementDataDictionary(
            { flowElement, contents });

          flowData.setElementData(data);

          resolve();
        }, 500);
      });
    },
    properties: {
      string: {
        type: 'string'
      }
    }
  }),

  error: new FlowElement({
    dataKey: 'error',
    processInternal: function (flowData) {
      throw 'Something went wrong';
    }
  }),

  stop: new FlowElement({
    dataKey: 'stopElement',
    processInternal: function (flowData) {
      flowData.stop();
    }
  }),

  neverRun: new FlowElement({
    dataKey: 'neverRun',
    processInternal: function (flowData) {
      const data = new ElementDataDictionary(
        { flowElement: this, contents: { no: false } });

      flowData.setElementData(data);
    }
  }),

  apvTest: new FlowElement({
    dataKey: 'apv',
    processInternal: function (flowData) {
      const data = new ElementDataDictionary({
        flowElement: this,
        contents: {
          yes: new AspectPropertyValue(null, 'success'),
          no: new AspectPropertyValue('Value missing')
        }
      }
      );

      flowData.setElementData(data);
    }
  }),

  device: new FlowElement({
    dataKey: 'device',
    additionalValues: {},
    processInternal: function (flowData) {
      const data = new ElementDataDictionary({
        flowElement: this,
        contents: {
          yes: new AspectPropertyValue(null, 'success'),
          no: new AspectPropertyValue('Value missing')
        }
      }
      );
      for (const [key, value] of Object.entries(this.additionalValues)) {
        data.contents[key] = value;
      }
      flowData.setElementData(data);
    }
  })
};
