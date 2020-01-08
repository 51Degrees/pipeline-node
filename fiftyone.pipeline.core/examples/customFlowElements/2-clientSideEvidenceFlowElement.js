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
@example 2-clientSideEvidenceFlowElement.js

This example demonstrates the creation of a custom flow element whcih takes the results of a client side form collecting date of birth, setting this as evidence on a flowData object to calculate a person's starsign. The flowElement also serves additional JavaScript which gets a user's geolocation and saves the latitude as a cookie. This latitude is also then passed in to the flowData to calculate if a person is in the northern or southern hemispheres.

*/

// First require the core Pipeline (change this to `fiftyone.pipeline.core` 
// to use the modules from NPM rather than your local code)
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
    evidenceKeyFilter: new FiftyOnePipelineCore.basicListEvidenceKeyFilter(["cookie.latitude", "query.dateOfBirth"]), // A filter (in this case a basic list) stating which evidence the flowElement is interested in

    // The processInternal function is the core working of a flowElement. It takes flowData, reads evidence and returns data.
    processInternal: function (flowData) {

        let result = {};

        // Get the date of birth from the query string (submitted through a form on the client side)
        let dateOfBirth = flowData.evidence.get("query.dateOfBirth");

        if (dateOfBirth) {

            dateOfBirth = dateOfBirth.split("-");

            let month = dateOfBirth[1];
            let day = dateOfBirth[2];

            result.starSign = getStarSign(month, day);

        }

        // Serve some JavaScript to the user that will be used to save a cookie with the user's latitude in it
        result.getLatitude = `
        navigator.geolocation.getCurrentPosition(function(position) {
            document.cookie = "latitude=" + position.coords.latitude;
        });
        `;

        // Get the latitude from the above cookie
        let latitude = flowData.evidence.get("cookie.latitude");

        // Calculate the hemisphere
        if (latitude) {

            result.hemisphere = latitude > 0 ? "Northern" : "Southern";

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
        },
        getLatitude: {
            type: "javascript",
            description: "JavaScript used to get a user's latitude"
        }
    }
});


const http = require('http');

let pipeline = new FiftyOnePipelineCore.pipelineBuilder()
    .add(astrology)
    .build();

const server = http.createServer((req, res) => {

    let flowData = pipeline.createFlowData();

    // Add any information from the request (headers, cookies and additional client side provided information)
    flowData.evidence.addFromRequest(req);

    
    flowData.process().then(function () {

        // Place JavaScript on the page that gets the user's location and saves the latitude in a cookie (for working out the hemisphere). 
        
        // This JavaScript is generated by the flowElement and fetched using the getWhere() method to get JavaScript properties.
        let js = Object.values(flowData.getWhere("type", "javascript")).join(" ");

        // Output the date of birth form and the JavaScript along with any results if they exist

        let output = `

        <h1>Starsigns</h1>

        ${flowData.astrology.starSign ? "<p>Your starsign is " + flowData.astrology.starSign + " </p>" : "<p>Add your date of birth to get your starsign</p>"}

        ${flowData.astrology.hemisphere ? "<p>Look at the " + flowData.astrology.hemisphere + " hemisphere stars tonight</p>" : ""}

        <form><label for='dateOfBirth'>Date of birth</label><input type='date' name='dateOfBirth' id='dateOfBirth'><input type='submit'></form>
        
        <script>

        ${js}

        </script>
        
        `;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(output);

    });

});

let portNum = process.env.PORT || 3000;
console.info("To test this example, browse to http://localhost:" + portNum);
server.listen(portNum);