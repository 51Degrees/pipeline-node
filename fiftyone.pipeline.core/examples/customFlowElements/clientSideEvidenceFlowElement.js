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
 * @example clientSideEvidenceFlowElement.js
 *
 * This example demonstrates the creation of a custom flow element
 * which takes the results of a client side form collecting
 * date of birth, setting this as evidence on a flowData object
 * to calculate a person's starsign.
 * The flowElement also serves additional JavaScript which gets a
 * user's geolocation and saves the latitude as a cookie.
 * This latitude is also then passed in to the flowData to
 * calculate if a person is in the northern or southern hemispheres.
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

    // datakey used to categorise data coming back from this
    // flowElement in a pipeline
    this.dataKey = 'astrology';

    // A filter (in this case a basic list) stating which
    // evidence the flowElement is interested in
    this.evidenceKeyFilter = new FiftyOnePipelineCore
      .BasicListEvidenceKeyFilter(
        ['cookie.latitude', 'query.dateOfBirth']
      );

    // The properties list includes extra information about
    // the properties available from a flowElement
    this.properties = {
      hemisphere: {
        type: 'string',
        description: "the user's hemisphere"
      },
      starSign: {
        type: 'string',
        description: "the user's starsign"
      },
      getLatitude: {
        type: 'javascript',
        description: "JavaScript used to get a user's latitude"
      }
    };
  }
  //! [constructor]

  // The processInternal function is the core working of a
  // flowElement. It takes flowData, reads evidence and returns data.
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

    // Get the latitude from the a cookie if client side
    // JavaScript to set the user's latitude has run
    const latitude = flowData.evidence.get('cookie.latitude');

    if (!latitude) {
      // If no cookie set, add client side javascript to set the cookie with
      // the user's latitude.
      // Note that the text '// 51D replace this comment
      // with callback function.'
      // will be replaced with a callback to indicate once the value has
      // been set.
      // This can trigger another request to the web server with the additional
      // information, which can then be processed and used to update the
      // JSON data on the client.
      result.getLatitude = `
      navigator.geolocation.getCurrentPosition(function(position)
      { document.cookie = 'latitude=' + position.coords.latitude; 
      // 51D replace this comment with callback function. 
      });
      `;
    } else {
      // Calculate the hemisphere
      result.hemisphere = latitude > 0 ? 'Northern' : 'Southern';
    }

    // Save the data into an extension of the
    // elementData class (in this case a simple dictionary subclass)

    const data = new FiftyOnePipelineCore.ElementDataDictionary({
      flowElement: this,
      contents: result
    });

    // Set this data on the flowElement
    flowData.setElementData(data);
  }
}

//! [class]

//! [usage]
const element = new Astrology();

const http = require('http');

const pipeline = new FiftyOnePipelineCore.PipelineBuilder({
  javascriptBuilderSettings: {
    endPoint: '/json'
  }
})
  .add(element)
  .build();

const server = http.createServer((req, res) => {
  const flowData = pipeline.createFlowData();

  // Add any information from the request
  // (headers, cookies and additional client side
  // provided information)
  flowData.evidence.addFromRequest(req);

  flowData.process().then(function () {
    // Send back JSON if requesting it from the client side
    // via the JavaScriptBuilder

    if (req.url.indexOf('/json') !== -1) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(flowData.jsonbundler.json));

      return;
    }

    // Place JavaScript on the page that gets the user's location
    // and saves the latitude in a cookie (for working out the hemisphere).

    const js = flowData.javascriptbuilder.javascript;

    const output = `

        <h1>Starsigns</h1>

        ${
          flowData.astrology.starSign
            ? '<p>Your starsign is ' + flowData.astrology.starSign + ' </p>'
            : '<p>Add your date of birth to get your starsign</p>'
        }

        <div id="hemispheretext">
        ${
          flowData.astrology.hemisphere
            ? '<p>Look at the ' +
              flowData.astrology.hemisphere +
              ' hemisphere stars tonight</p>'
            : ''
        }
        </div>

        <form><label for='dateOfBirth'>Date of birth</label>
        <input type='date' name='dateOfBirth' id='dateOfBirth'>
        <input type='submit'></form>
        
        <script>

        ${js}

        // This function will fire when the JSON data object is updated 
        // with information from the server.
        // The sequence is:
        // 1. Response contains JavaScript property 'getLatitude' 
        // that gets executed on the client
        // 2. This triggers another call to the webserver 
        // that passes the location as evidence
        // 3. The web server responds with new JSON data 
        // that contains the hemisphere based on the location.
        // 4. The JavaScript integrates the new JSON data and 
        // fires the onChange callback below.
        window.onload = function() {
            fod.complete(function (data) {  
              console.log(data);
                if(data.astrology.hemisphere) {          
                    var para = document.createElement("p");
                    var text = document.createTextNode("Look at the " + 
                        data.astrology.hemisphere + " hemisphere tonight");
                    para.appendChild(text);

                    var element = document.getElementById("hemispheretext");
                    var child = element.lastElementChild;  
                    while (child) { 
                        element.removeChild(child); 
                        child = element.lastElementChild; 
                    } 

                    element.appendChild(para);
                }
            });
        }

        </script>
        
        `;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(output);
  });
});

const portNum = process.env.PORT || 3000;
console.info('To test this example, browse to http://localhost:' + portNum);
server.listen(portNum);
//! [usage]
