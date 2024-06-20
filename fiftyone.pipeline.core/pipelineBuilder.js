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

const Pipeline = require('./pipeline');

const fs = require('fs');
const path = require('path');

/**
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('events').EventEmitter} EventEmitter
 */

/**
 * A PipelineBuilder generates a Pipeline object
 * Before construction of the Pipeline, FlowElements are added to it
 * There are also options for how JavaScript is output from the Pipeline
 */
class PipelineBuilder {
  /**
   * Constructor for pipeline builder
   *
   * @param {object} settings settings for the pipeline being
   * constructed
   * @param {boolean} settings.addJavaScriptBuilder Whether to
   * automatically add the JSONBundler, JavaScriptBuilder
   * and Sequence elements needed to output JavaScript
   * from the system and generate an endpoint for fetching the properties
   * generated by a pipeline from the client side. This is
   * true by default.
   * @param {boolean} settings.useSetHeaderProperties Whether to
   * automatically add the SetHeadersElement needed to request additional
   * HTTP headers from the client side. This is true by default.
   * @param {typeof import('./javascriptbuilder').prototype.settings} settings.javascriptBuilderSettings
   * The settings to pass to the JavaScriptBuilder.
   * See JavaScriptBuilder class for details.
   * @param {EventEmitter} settings.eventEmitter A logger for emitting messages for pipeline
   */
  constructor (settings = {}) {
    /**
     * @type {FlowElement[]}
     */
    this.flowElements = [];

    if (typeof settings.addJavaScriptBuilder !== 'undefined') {
      this.addJavaScriptBuilder = settings.addJavaScriptBuilder;
    } else {
      this.addJavaScriptBuilder = true;
    }

    if (settings.javascriptBuilderSettings) {
      this.javascriptBuilderSettings = settings.javascriptBuilderSettings;
    }

    if (typeof settings.useSetHeaderProperties !== 'undefined') {
      this.useSetHeaderProperties = settings.useSetHeaderProperties;
    } else {
      this.useSetHeaderProperties = true;
    }

    if (settings.eventEmitter) {
      this.eventEmitter = settings.eventEmitter;
    }
  }

  /**
   * Helper that loads a JSON configuration file from
   * the filesystem and calls pipelineBuilder.buildFromConfiguration
   *
   * @param {string} configPath path to a JSON configuration file
   * @returns {Pipeline} the constructed pipeline
   */
  buildFromConfigurationFile (configPath) {
    const file = fs.readFileSync(configPath, 'utf8');

    const parsedFile = JSON.parse(file);

    return this.buildFromConfiguration(parsedFile);
  }

  /**
   * Create a pipeline from a JSON configuration
   *
   * @param {object} config a JSON configuration object
   * @returns {Pipeline} the constructed pipeline
   */
  buildFromConfiguration (config) {
    let flowElements = [];

    config.PipelineOptions.Elements.forEach(function (element) {
      let FlowElement;

      try {
        FlowElement = require(element.elementName);
      } catch (e) {
        try {
          const localPath = path.resolve(process.cwd(), element.elementName);

          FlowElement = require(localPath);
        } catch (e) {
          throw "Can't find " + element.elementName;
        }
      }

      if (!element.elementParameters) {
        element.elementParameters = {};
      }

      flowElements.push(new FlowElement(element.elementParameters));
    });

    flowElements = this.addRequiredElements(flowElements);

    return new Pipeline(flowElements, false);
  }

  /**
   * Add required elements to an existing FlowElement array
   *
   * @param {FlowElement[]} flowElements array of elements to add to
   * @returns {FlowElement[]} resulting array with required elements
   */
  addRequiredElements (flowElements) {
    return flowElements
      .concat(this.getJavaScriptElements())
      .concat(this.getHttpElements());
  }

  /**
   * Internal function used to first check if the
   * JavaScript elements should be added to the pipeline
   * and add them if requested.
   *
   * @returns {FlowElement[]} list of JavaScript related
   * FlowElements
   */
  getJavaScriptElements () {
    const flowElements = [];

    if (this.addJavaScriptBuilder) {
      // Add JavaScript elements

      const JavascriptBuilder = require('./javascriptbuilder');
      const JsonBundler = require('./jsonbundler');
      const SequenceElement = require('./sequenceElement');

      flowElements.push(new SequenceElement());
      flowElements.push(new JsonBundler());

      if (this.javascriptBuilderSettings) {
        flowElements.push(
          new JavascriptBuilder(this.javascriptBuilderSettings)
        );
      } else {
        flowElements.push(new JavascriptBuilder({}));
      }
    }

    return flowElements;
  }

  /**
   * Internal function used to first check if the
   * HTTP elements should be added to the pipeline
   * and add them if requested.
   *
   * @returns {FlowElement[]} list of HTTP related
   * FlowElements
   */
  getHttpElements () {
    const flowElements = [];

    if (this.useSetHeaderProperties) {
      // Add HTTP elements

      const SetHeadersElement = require('./setHeadersElement');

      flowElements.push(new SetHeadersElement());
    }

    return flowElements;
  }

  /**
   * Add a single flowElement to be executed in series
   *
   * @param {FlowElement} flowElement flowElement to add to the
   * Pipeline
   * @returns {PipelineBuilder} Pipeline builder for easy chaining
   */
  add (flowElement) {
    this.flowElements.push(flowElement);

    return this;
  }

  /**
   * Add an array of flowElements to be executed in parallel
   *
   * @param {FlowElement[]} flowElements array of FlowElements
   * to add to the Pipeline (to be exeuted in parallel)
   * @returns {PipelineBuilder} Pipeline builder for easy chaining
   */
  addParallel (flowElements) {
    this.flowElements.push(flowElements);

    return this;
  }

  /**
   * Build the pipeline from the flowElements that have been added
   *
   * @returns {Pipeline} The constructed Pipeline
   */
  build () {
    this.flowElements = this.addRequiredElements(this.flowElements);
    return new Pipeline(this.flowElements, false, this.eventEmitter);
  }
}

module.exports = PipelineBuilder;
