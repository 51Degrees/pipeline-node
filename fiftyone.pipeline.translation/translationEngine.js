/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
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
const FlowElement = core.FlowElement;
const BasicListEvidenceKeyFilter = core.BasicListEvidenceKeyFilter;
const AspectPropertyValue = core.AspectPropertyValue;

const yaml = require('js-yaml');

const Languages = require('./languages');
const Translator = require('./translator');
const TranslationData = require('./translationData');
const MissingTranslationBehavior = require('./missingTranslationBehavior');

/**
 * The evidence keys, in precedence order, used to find the locale code for
 * the language to translate to.
 */
const evidenceKeys = [
  'query.translation',
  'query.accept-language',
  'header.accept-language'
];

// Regex used to identify language locale codes (e.g. 'fr_FR').
const localeRegex = /[a-z]{2}_[A-Z]{2}/;

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

/**
 * @typedef {object} TranslationProperty
 * @property {string} source the name of the property read from the source
 * element data
 * @property {string} destination the name of the property written to this
 * element's data
 */

/**
 * Flow element that translates values from a single source element and stores
 * the translated values under its own element data key.
 *
 * Translations are provided as YAML files, where the file name defines the
 * locale contained in the file (e.g. 'countries.fr_FR.yml'). The language to
 * translate to is taken from a fixed language supplied to the constructor, or,
 * when none is supplied, by looking through the evidence for the keys in
 * {@link evidenceKeys}.
 *
 * Only string based values are supported for translation (string, array of
 * strings, weighted list of strings, or an AspectPropertyValue wrapping one of
 * those) and the shape of an output property matches its input.
 */
class TranslationEngine extends FlowElement {
  /**
   * Constructor.
   *
   * @param {object} options the options object
   * @param {string} options.sourceDataKey element data key of the source flow
   * element to read the properties to translate from
   * @param {string} [options.elementDataKey] element data key this engine
   * stores its results under; defaults to 'translation'
   * @param {Array<TranslationProperty>} options.translations the source to
   * destination property name pairs to translate
   * @param {object} options.sources the translation sources, a key/value map
   * of file name to YAML content string
   * @param {string} [options.fixedLanguage] a fixed locale to always translate
   * to; when null or omitted the language is taken from the evidence
   * @param {string} [options.behavior] the {@link MissingTranslationBehavior}
   * to use when a translation is missing; defaults to Original
   */
  constructor ({
    sourceDataKey,
    elementDataKey = 'translation',
    translations,
    sources,
    fixedLanguage = null,
    behavior = MissingTranslationBehavior.Original
  } = {}) {
    super();

    if (!translations || translations.length === 0) {
      throw 'At least one property translation must be configured.';
    }
    if (!sources || Object.keys(sources).length === 0) {
      throw 'At least one source file must be configured.';
    }
    if (typeof sourceDataKey !== 'string' || sourceDataKey.trim() === '') {
      throw 'The source element key must be configured.';
    }

    this.dataKey = elementDataKey;
    this.sourceDataKey = sourceDataKey.trim();
    this.translationProperties = translations;
    this.behavior = behavior;
    this.emptyTranslator = new Translator(null, behavior);
    this.fixedLanguage = fixedLanguage !== null && fixedLanguage !== undefined
      ? TranslationEngine.validateLocale(fixedLanguage)
      : null;
    this.languages = TranslationEngine.parseSources(sources, behavior);

    this.evidenceKeyFilter = new BasicListEvidenceKeyFilter(evidenceKeys);

    // Advertise the distinct destination properties.
    this.properties = {};
    translations.forEach((translation) => {
      this.properties[translation.destination] = { type: 'weightedstring' };
    });
  }

  /**
   * Translate the configured properties from the source element and store the
   * results under this element's data key.
   *
   * @param {FlowData} flowData the flow data being processed
   */
  processInternal (flowData) {
    const data = new TranslationData({ flowElement: this, contents: {} });
    flowData.setElementData(data);

    // Get the source data from the flow data.
    let sourceData;
    try {
      sourceData = flowData.get(this.sourceDataKey);
    } catch (e) {
      flowData.setError('The source data \'' + this.sourceDataKey +
        '\' could not be found in the FlowData.', this);
      return;
    }

    // Get the target language.
    const language = this.getTargetLanguage(flowData);
    if (language === null) {
      if (this.behavior === MissingTranslationBehavior.FlowError) {
        flowData.setError('The evidence did not contain a language to ' +
          'translate to.', this);
      } else {
        this.populate(sourceData, this.emptyTranslator, data, flowData);
      }
      return;
    }

    // Get the translator for the resolved language.
    const resolved = this.languages.getTranslator(language);
    if (resolved === null) {
      if (this.behavior === MissingTranslationBehavior.FlowError) {
        flowData.setError('There was no translator configured for the ' +
          'language \'' + language + '\'.', this);
      } else {
        this.populate(sourceData, this.emptyTranslator, data, flowData);
      }
      return;
    }

    this.populate(sourceData, resolved.translator, data, flowData);
  }

  /**
   * Populate the translation data with every configured translation using the
   * provided translator.
   *
   * @param {object} sourceData the source element data
   * @param {Translator} translator the translator to use
   * @param {TranslationData} translationData the element data to populate
   * @param {FlowData} flowData the flow data being processed
   */
  populate (sourceData, translator, translationData, flowData) {
    this.translationProperties.forEach((property) => {
      const sourceValue = TranslationEngine.tryGetSourceValue(
        sourceData, property.source);
      if (sourceValue === undefined) {
        // The source property could not be found, so store a no-value result.
        translationData.contents[property.destination] =
          new AspectPropertyValue('The source property \'' +
            property.source + '\' could not be found in the source data.');
      } else {
        const errors = [];
        translationData.contents[property.destination] =
          translator.translate(sourceValue, errors);
        errors.forEach((error) => flowData.setError(error, this));
      }
    });
  }

  /**
   * Find the highest precedence evidence value that supplies a language to
   * translate to, or the fixed language when one is configured.
   *
   * @param {FlowData} flowData the flow data being processed
   * @returns {string|null} the language value, or null when none is available
   */
  getTargetLanguage (flowData) {
    if (this.fixedLanguage !== null) {
      return this.fixedLanguage;
    }
    const evidence = flowData.evidence.getAll();
    const lowered = {};
    Object.keys(evidence).forEach((key) => {
      lowered[key.toLowerCase()] = evidence[key];
    });
    for (const key of evidenceKeys) {
      const value = lowered[key];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
    return null;
  }

  /**
   * Safely read a property value from the source element data, returning
   * undefined when the property is not present rather than throwing.
   *
   * @param {object} sourceData the source element data
   * @param {string} property the property name to read
   * @returns {*} the source value, or undefined when not present
   */
  static tryGetSourceValue (sourceData, property) {
    if (!sourceData || typeof property !== 'string' || property === '') {
      return undefined;
    }
    try {
      return sourceData.get(property);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Parse the supplied YAML sources into a {@link Languages} instance with a
   * translator for each file.
   *
   * @param {object} sources key/value map of file name to YAML content
   * @param {string} behavior the missing translation behaviour to use
   * @returns {Languages} the parsed languages
   */
  static parseSources (sources, behavior) {
    const languages = new Languages();
    Object.keys(sources).forEach((fileName) => {
      const locale = TranslationEngine.getLanguageName(fileName);
      const translations = yaml.load(sources[fileName]);
      if (translations === null || translations === undefined) {
        throw 'The source for ' + fileName + ' could not be parsed into a ' +
          'valid translation lookup.';
      }
      languages.addLanguage(locale, new Translator(translations, behavior));
    });
    return languages;
  }

  /**
   * Get the locale code from a source file name (e.g. 'countries.fr_FR.yml'
   * yields 'fr_FR').
   *
   * @param {string} name the source file name
   * @returns {string} the locale code
   */
  static getLanguageName (name) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw 'Source name cannot be null or whitespace.';
    }
    const parts = name.split('.');
    if (parts.length < 3) {
      throw 'Source name \'' + name + '\' does not have the correct format. ' +
        'It should be \'somename.locale.yml\' e.g. \'countries.en_GB.yml\'.';
    }
    const locale = TranslationEngine.validateLocale(parts[parts.length - 2]);
    if (locale === null) {
      throw 'Source name \'' + name + '\' does not contain a valid locale ' +
        'code.';
    }
    return locale;
  }

  /**
   * Validate a locale code against the expected `xx_XX` format.
   *
   * @param {string} locale the code to validate
   * @returns {string|null} the valid locale code, or null
   */
  static validateLocale (locale) {
    const match = localeRegex.exec(locale);
    return match !== null ? match[0] : null;
  }
}

module.exports = TranslationEngine;
