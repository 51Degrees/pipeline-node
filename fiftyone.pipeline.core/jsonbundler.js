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

const FlowElement = require('./flowElement.js');
const ElementDataDictionary = require('./elementDataDictionary.js');
const BasicListEvidenceKeyFilter = require('./basicListEvidenceKeyFilter.js');

/**
 * @typedef {import('./flowData')} FlowData
 */

const elementBlacklist = ['jsonbundler', 'javascriptbuilder', 'sequence', 'set-headers'];

/**
 * The JSONBundler aggregates all properties from FlowElements
 * into a JSON object
 * It is used for retrieving via an endpoint from the client
 * side via the JavaScriptBuilder and also used inside the
 * JavaScriptBuilder itself to pass properties to the client side.
 * Both this and the JavaScriptBuilder element are automatically
 * added to a pipeline unless specifically ommited in the PipelineBuilder
 */
class JSONBundlerElement extends FlowElement {
  constructor () {
    super(...arguments);

    this.dataKey = 'jsonbundler';
    this.evidenceKeyFilter = new BasicListEvidenceKeyFilter([]);
    this.propertyCache = null;
  }

  /**
   * The JSON Builder extracts all properties and serializes them into JSON
   *
   * @param {FlowData} flowData the FlowData being processed
   */
  processInternal (flowData) {
    // Get every property on every flowElement
    // Storing JavaScript properties in an extra section

    const output = {
      javascriptProperties: []
    };

    // Check if property cache has already been set

    let propertyCacheSet;

    if (this.propertyCache) {
      propertyCacheSet = true;
    } else {
      propertyCacheSet = false;
      this.propertyCache = {};
    }

    for (const flowElement in flowData.pipeline.flowElements) {
      let blacklisted = false;
      elementBlacklist.forEach(name => {
        if (name === flowElement) {
          blacklisted = true;
        }
      });
      if (blacklisted) {
        continue;
      }

      // Create empty area for flowElement properties to go
      output[flowElement.toLowerCase()] = {};

      const flowElementObject = flowData.pipeline.flowElements[flowElement];

      const properties = flowElementObject.getProperties();

      if (!propertyCacheSet) {
        const delayExecutionList = [];
        const delayedEvidenceProperties = {};

        // Loop over all properties and see if any have delay execution set to true

        for (const property in properties) {
          const propertyInfo = properties[property];

          if (propertyInfo.delayexecution) {
            delayExecutionList.push(property);
          }
        }

        // Loop over all properties again and see if any have evidenceproperties which
        // have delayedExecution set to true

        for (const property in properties) {
          const propertyInfo = properties[property];

          if (propertyInfo.evidenceproperties) {
            const delayedEvidencePropertiesList = propertyInfo.evidenceproperties.filter(function (evidenceProperty) {
              return delayExecutionList.indexOf(evidenceProperty) !== -1;
            });

            if (delayedEvidencePropertiesList.length) {
              delayedEvidenceProperties[property] = delayedEvidencePropertiesList.map(function (property) {
                return flowElement + '.' + property;
              });
            }
          }
        }

        this.propertyCache[flowElement.dataKey] = {
          delayExecutionList,
          evidenceProperties: delayedEvidenceProperties
        };
      }

      const propertyCache = this.propertyCache[flowElement.dataKey];

      for (const property in properties) {
        // Check if property has delayed execution and set in JSON if yes

        if (propertyCache.delayExecutionList.indexOf(property) !== -1) {
          output[flowElement.toLowerCase()][property.toLowerCase() + 'delayexecution'] = true;
        }

        // Check if property has any delayed execution evidence properties and set in JSON if yes

        if (propertyCache.evidenceProperties[property]) {
          output[flowElement.toLowerCase()][property.toLowerCase() + 'evidenceproperties'] = propertyCache.evidenceProperties[property];
        }

        // Get the value

        let value;
        let nullReason = 'Unknown';

        try {
          const valueContainer = flowData.get(flowElement).get(property);

          // Check if value is of the aspect property value type

          if (valueContainer.hasOwnProperty('hasValue')) {
            // Check if it has a value

            if (valueContainer.hasValue) {
              value = valueContainer.value;
            } else {
              value = null;
              nullReason = valueContainer.noValueMessage;
            }
          } else {
            // Standard value

            value = valueContainer;
          }
        } catch (e) {
          // Catching missing property exceptions and other errors

          continue;
        }

        output[flowElement.toLowerCase()][property.toLowerCase()] = value;
        if (value == null) {
          output[flowElement.toLowerCase()][property.toLowerCase() + 'nullreason'] = nullReason;
        }

        const propertyObject = properties[property];

        if (
          !flowData.evidence.get('query.sequence') ||
          flowData.evidence.get('query.sequence') < 10
        ) {
          const type =
            propertyObject[
              Object.keys(propertyObject).find(
                (key) => key.toLowerCase() === 'type'
              )
            ];

          if (type && type.toLowerCase() === 'javascript') {
            if (value) {
              output.javascriptProperties.push(flowElement.toLowerCase() + '.' + property.toLowerCase());
            }
          }
        }
      }
    }

    const data = new ElementDataDictionary({
      flowElement: this,
      contents: { json: output }
    });

    flowData.setElementData(data);
  }
}

module.exports = JSONBundlerElement;
