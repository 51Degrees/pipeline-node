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

const crypto = require('crypto');

const FlowElement = require('./flowElement.js');
const BasicListEvidenceKeyFilter = require('./basicListEvidenceKeyFilter');

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * The SequenceElement stores session data regarding requests
 * for client side JavaScript from the JavaScript created by a
 * Pipeline's JavaScriptBuilder
 * If a Pipeline is constructed with the JavaScript elements enabled
 * this is added automatically along with the JavaScriptBuilder and JSONBundler.
 **/
class SequenceElement extends FlowElement {
  constructor () {
    super(...arguments);

    this.dataKey = 'sequence';

    this.evidenceKeyFilter = new BasicListEvidenceKeyFilter([]);
  }

  /**
   * Internal process function for the sequence element
   * Checks if there is a session id and sequence number set
   * if there is it increments the sequence number for that session
   * if not it initialises both
   *
   * @param {FlowData} flowData flowData with the evidence in it
   */
  processInternal (flowData) {
    // Check if session id is set in evidence

    if (flowData.evidence.get('query.session-id')) {
      // Get current sequence number

      let sequence = flowData.evidence.get('query.sequence');

      if (sequence) {
        sequence = parseInt(sequence);
      } else {
        sequence = 1;
      }

      flowData.evidence.add('query.sequence', sequence + 1);
    } else {
      flowData.evidence.add(
        'query.session-id',
        crypto.randomBytes(16).toString('hex')
      );

      flowData.evidence.add('query.sequence', 1);
    }
  }
}

module.exports = SequenceElement;
