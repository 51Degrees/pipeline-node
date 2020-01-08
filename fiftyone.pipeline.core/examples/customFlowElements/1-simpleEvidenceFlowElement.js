/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2019 51 Degrees Mobile Experts Limited, 5 Charlotte Close,
 * Caversham, Reading, Berkshire, United Kingdom RG4 7BY.
 *
 * This Original Work is licensed under the European Union Public Licence (EUPL) 
 * v.1.2 and is subject to its terms as set out below.
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
@example 1-simpleEvidenceFlowElement.js

This example demonstrates the creation of a custom flow element which takes a birth date as evidence and uses it to check a lookup table for a starsign.

*/

// First require the core Pipeline (change this to `fiftyone.pipeline.core` 
// to use the modules from NPM rather than your local code)

console.log(process.env.directory);

const FiftyOnePipelineCore = require((process.env.directory || __dirname) + "/../../");

// Function to get star sign from month and day
let getStarSign = (month, day) => {

    if ((month == 1 && day <= 20) || (month == 12 && day >= 22)) {
        return "capricorn";
    } else if ((month == 1 && day >= 21) || (month == 2 && day <= 18)) {
        return "aquarius";
    } else if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) {
        return "pisces";
    } else if ((month == 3 && day >= 21) || (month == 4 && day <= 20)) {
        return "aries";
    } else if ((month == 4 && day >= 21) || (month == 5 && day <= 20)) {
        return "taurus";
    } else if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) {
        return "gemini";
    } else if ((month == 6 && day >= 22) || (month == 7 && day <= 22)) {
        return "cancer";
    } else if ((month == 7 && day >= 23) || (month == 8 && day <= 23)) {
        return "leo";
    } else if ((month == 8 && day >= 24) || (month == 9 && day <= 23)) {
        return "virgo";
    } else if ((month == 9 && day >= 24) || (month == 10 && day <= 23)) {
        return "libra";
    } else if ((month == 10 && day >= 24) || (month == 11 && day <= 22)) {
        return "scorpio";
    } else if ((month == 11 && day >= 23) || (month == 12 && day <= 21)) {
        return "sagittarius";
    }

};

// Astrology flowElement
let astrology = new FiftyOnePipelineCore.flowElement({
    dataKey: "astrology", // datakey used to categorise data coming back from this flowElement in a pipeline
    evidenceKeyFilter: new FiftyOnePipelineCore.basicListEvidenceKeyFilter(["user.dateOfBirth"]), // A filter (in this case a basic list) stating which evidence the flowElement is interested in

    // The processInternal function is the core working of a flowElement. It takes flowData, reads evidence and returns data.
    processInternal: function (flowData) {

        let result = {};

        // Get the date of birth from the query string (submitted through a form on the client side)
        let dateOfBirth = flowData.evidence.get("user.dateOfBirth");

        if (dateOfBirth) {

            dateOfBirth = dateOfBirth.split("-");

            let month = dateOfBirth[1];
            let day = dateOfBirth[2];

            result.starSign = getStarSign(month, day);

        }

        // Save the data into an extension of the elementData class (in this case a simple dictionary subclass)
        let data = new FiftyOnePipelineCore.elementDataDictionary({
            flowElement: this, contents: result
        });

        // Set this data on the flowElement
        flowData.setElementData(data);

    },
    // The properties list includes extra information about the properties available from a flowElement
    properties: {
        starSign: {
            type: "string",
            description: "the user's starsign"
        }
    }
});

// Create the pipeline and add the astrology flowElement 
let pipeline = new FiftyOnePipelineCore.pipelineBuilder()
    .add(astrology)
    .build();

// Create the flowData object used to set evidence on and get results from
let flowData = pipeline.createFlowData();
    
// Add the date of birth evidence
flowData.evidence.add("user.dateOfBirth", "2019-09-26");

// Process the flowData
flowData.process().then(function () {

    // Get the starsign from the results

    console.log(flowData.astrology.starSign);

});
