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

/**
 * @example simpleEvidenceFlowElement.js
 *
 * This example demonstrates the creation of a custom flowElement
 * which takes a birth date as evidence and uses it to check a
 * lookup table for a starsign.
 *
 */

// First require the core Pipeline
// Note that this example is designed to be run from within the
// source repository. If this code has been copied to run standalone
// then you'll need to replace the require below with the commented
// out version below it.
const FiftyOnePipelineCore = require(
  (process.env.directory || __dirname) + '/../../'
);
// const FiftyOnePipelineCore = require("fiftyone.pipeline.core");

// Function to get star sign from month and day
const getStarSign = (month, day) => {
  if ((month === 1 && day <= 20) || (month === 12 && day >= 22)) {
    return 'capricorn';
  } else if ((month === 1 && day >= 21) || (month === 2 && day <= 18)) {
    return 'aquarius';
  } else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) {
    return 'pisces';
  } else if ((month === 3 && day >= 21) || (month === 4 && day <= 20)) {
    return 'aries';
  } else if ((month === 4 && day >= 21) || (month === 5 && day <= 20)) {
    return 'taurus';
  } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
    return 'gemini';
  } else if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) {
    return 'cancer';
  } else if ((month === 7 && day >= 23) || (month === 8 && day <= 23)) {
    return 'leo';
  } else if ((month === 8 && day >= 24) || (month === 9 && day <= 23)) {
    return 'virgo';
  } else if ((month === 9 && day >= 24) || (month === 10 && day <= 23)) {
    return 'libra';
  } else if ((month === 10 && day >= 24) || (month === 11 && day <= 22)) {
    return 'scorpio';
  } else if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) {
    return 'sagittarius';
  }
};

//! [class]
//! [constructor]
// Astrology flowElement
class Astrology extends FiftyOnePipelineCore.FlowElement {
  constructor () {
    super(...arguments);

    // datakey used to categorise data coming back from
    // this flowElement in a pipeline
    this.dataKey = 'astrology';

    // A filter (in this case a basic list) stating which evidence the
    // flowElement is interested in, in this case a query string
    this.evidenceKeyFilter = new FiftyOnePipelineCore
      .BasicListEvidenceKeyFilter(['query.dateOfBirth']);

    // The properties list includes extra information about
    // the properties available from a flowElement
    this.properties = {
      starSign: {
        type: 'string',
        description: "the user's starsign"
      }
    };
  }
  //! [constructor]

  // Internal processing function
  processInternal (flowData) {
    const result = {};

    // Get the date of birth from the query string
    // (submitted through a form on the client side)
    let dateOfBirth = flowData.evidence.get('query.dateOfBirth');

    if (dateOfBirth) {
      dateOfBirth = dateOfBirth.split('-');

      const month = parseInt(dateOfBirth[1]);
      const day = parseInt(dateOfBirth[2]);

      result.starSign = getStarSign(month, day);
    }

    // Save the data into an extension of the elementData class
    // (in this case a simple dictionary subclass)
    const data = new FiftyOnePipelineCore.ElementDataDictionary({
      flowElement: this, contents: result
    });

    // Set this data on the flowElement
    flowData.setElementData(data);
  }
}
//! [class]

//! [usage]

const element = new Astrology();

// Create the pipeline and add the astrology flowElement
const pipeline = new FiftyOnePipelineCore.PipelineBuilder()
  .add(element)
  .build();

// Create the flowData object used to set evidence on and get results from
const flowData = pipeline.createFlowData();

// Add the date of birth evidence
flowData.evidence.add('query.dateOfBirth', '2019-09-26');

// Process the flowData
flowData.process().then(function () {
  // Get the starsign from the results

  console.log(flowData.astrology.starSign);
});

//! [usage]
