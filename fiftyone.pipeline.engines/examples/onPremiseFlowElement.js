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
 * @example onPremiseFlowElement.js
 *
 * This example demonstrates the creation of a custom flow element which takes a
 * birth date as evidence and uses it to check a lookup table for a starsign.
 * This lookup table is stored in a JSON file which is registered using the
 * datafile update service. In this case the file has a simple watcher which
 * checks if the file has changed.
 *
 */
const path = require('path');

// Require the filesystem module for datafile reading
const fs = require('fs');

// First require the core Pipeline
const FiftyOnePipelineCore = require(path.resolve(__dirname, '../../fiftyone.pipeline.core'));

// Next require the engines extension that extends flowElements to support
// functionality such as auto updating datafiles,
// caches and missing property services

// Note that this example is designed to be run from within the
// source repository. If this code has been copied to run standalone
// then you'll need to replace the require below with the commented
// out version below it.
const FiftyOnePipelineEngines = require(path.resolve(__dirname, '..'));
// const FiftyOnePipelineEngines = require("fiftyone.pipeline.engines");

//! [class]
//! [constructor]
// Astrology flowElement
class Astrology extends FiftyOnePipelineEngines.Engine {
  constructor ({ datafile }) {
    super(...arguments);

    // Create a datafile including a filesystem watcher that checks if
    // the datafile has changed. Test by changing the names of the
    // starsigns to see it update
    this.dataFile = new FiftyOnePipelineEngines
      .DataFile(
        {
          flowElement: this,
          path: datafile,
          autoUpdate: false,
          fileSystemWatcher: true
        }
      );

    this.registerDataFile(this.dataFile);

    // datakey used to categorise data coming back from
    // this flowElement in a pipeline
    this.dataKey = 'astrology';

    // A filter (in this case a basic list) stating which evidence the
    // flowElement is interested in, in this case a query string
    this.evidenceKeyFilter = new FiftyOnePipelineCore
      .BasicListEvidenceKeyFilter(['query.dateOfBirth']);

    // Update the datafile
    this.refresh();
  }
  //! [constructor]

  //! [refresh]
  // A function called when the datafile is updated / refreshed. In this
  // case it simply loads the JSON from the file into the engine's memory.
  refresh () {
    const engine = this;

    fs.readFile(this.dataFile.path, 'utf8', function (err, data) {
      if (err) {
        return console.error(err);
      }

      data = JSON.parse(data);

      // Load the datafile into memory and parse it to make it
      // more easily readable
      data = data.map(function (e) {
        const start = e[1].split('/');
        const end = e[2].split('/');

        return {
          starsign: e[0],
          startMonth: parseInt(start[1]),
          startDate: parseInt(start[0]),
          endMonth: parseInt(end[1]),
          endDate: parseInt(end[0])
        };
      });

      engine.data = data;
    });
  }
  //! [refresh]

  // Internal processing function
  processInternal (flowData) {
    let dateOfBirth = flowData.evidence.get('query.dateOfBirth');

    // Collect data to save back into the flowData under this engine

    const result = {};

    // Lookup the date of birth using the provided and now parsed datafile

    if (dateOfBirth) {
      dateOfBirth = dateOfBirth.split('-');

      const month = parseInt(dateOfBirth[1]);
      const day = parseInt(dateOfBirth[2]);

      result.starSign = this.data.filter(function (date) {
        // Find starsigns in the correct month

        if (date.startMonth === month) {
          if (date.startDate > day) {
            return false;
          } else if (date.endMonth === month && date.endDate <= day) {
            return false;
          } else {
            return true;
          }
        } else if (date.endMonth === month) {
          if (date.endDate < day) {
            return false;
          } else {
            return true;
          }
        } else {
          return false;
        }
      })[0].starsign;
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
const astrologyElement = new Astrology(
  { datafile: (process.env.directory || __dirname) + '/astrology.json' }
);

const http = require('http');

const pipeline = new FiftyOnePipelineCore.PipelineBuilder()
  .add(astrologyElement)
  .build();

const server = http.createServer((req, res) => {
  if (req.url !== '/favicon.ico') {
    const flowData = pipeline.createFlowData();

    // Add any information from the request
    // (headers, cookies and additional client side provided information)
    flowData.evidence.addFromRequest(req);

    flowData.process().then(function () {
      // Output the date of birth form with any results if they exist

      const output = `
  
          <h1>Starsigns</h1>
  
          ${flowData.astrology.starSign
            ? '<p>Your starsign is ' +
              flowData.astrology.starSign + ' </p>'
            : '<p>Add your date of birth to get your starsign</p>'
          }
  
          <form>
            <label for='dateOfBirth'>Date of birth</label>
            <input type='date' name='dateOfBirth' id='dateOfBirth'>
            <input type='submit'>
          </form>
          
          `;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.end(output);
    });
  }
});

const portNum = process.env.PORT || 3000;
console.info('To test this example, browse to http://localhost:' + portNum);
server.listen(portNum);
//! [usage]
