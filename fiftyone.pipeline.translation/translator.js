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

const AspectPropertyValue =
  require('fiftyone.pipeline.core').AspectPropertyValue;
const MissingTranslationBehavior = require('./missingTranslationBehavior');

/**
 * Determine whether a value is an AspectPropertyValue (it exposes a
 * `hasValue` boolean). Duck-typed rather than using `instanceof` so that the
 * check works even when the value originates from a different copy of the
 * core package.
 *
 * @param {*} value value to inspect
 * @returns {boolean} true if the value looks like an AspectPropertyValue
 */
const isAspectPropertyValue = (value) =>
  value !== null && typeof value === 'object' &&
  typeof value.hasValue === 'boolean';

/**
 * Determine whether an array element is a weighted value, i.e. an object of
 * the shape `{ value, weight, rawWeight }` as surfaced by the IP intelligence
 * engine.
 *
 * @param {*} item array element to inspect
 * @returns {boolean} true if the item looks like a weighted value
 */
const isWeightedValue = (item) =>
  item !== null && typeof item === 'object' && 'value' in item;

/**
 * Translates values based on a set of translations. The result is the same
 * shape as the source, e.g. a string is translated to a string, a list of
 * strings to a list of strings, a weighted list of strings to a weighted list
 * of strings (with the original weights preserved), and an AspectPropertyValue
 * wrapping any of those to an AspectPropertyValue of the same form.
 */
class Translator {
  /**
   * Constructor.
   *
   * @param {object} translations key/value lookup where the key is the source
   * value and the value is the translated value. May be null or empty for a
   * pass-through translator.
   * @param {string} behavior the {@link MissingTranslationBehavior} to use
   * when a translation is missing for a value.
   */
  constructor (translations, behavior) {
    this.behavior = behavior;
    // Store the lookup with lower-cased keys so that lookups are
    // case-insensitive, mirroring the .NET InvariantCultureIgnoreCase
    // dictionary.
    this.translations = {};
    if (translations) {
      Object.keys(translations).forEach((key) => {
        this.translations[key.toLowerCase()] = translations[key];
      });
    }
  }

  /**
   * Translate a value to the language this translator is configured for.
   *
   * @param {*} value the value to translate (string, array of strings,
   * weighted list of strings, or an AspectPropertyValue wrapping one of those)
   * @param {Array} errors list to which any errors encountered during
   * translation are added
   * @returns {*} the translated value, of the same shape as the input
   */
  translate (value, errors) {
    if (typeof value === 'string') {
      return this.translateString(value, errors);
    }
    if (isAspectPropertyValue(value)) {
      return this.translateAspect(value, errors);
    }
    if (Array.isArray(value)) {
      return this.translateArray(value, errors);
    }
    throw 'The value type is not supported for translation.';
  }

  /**
   * Translate an AspectPropertyValue, preserving the no-value message when the
   * source has no value.
   *
   * @param {object} value the AspectPropertyValue to translate
   * @param {Array} errors list to which any errors are added
   * @returns {object} a new AspectPropertyValue holding the translated value
   */
  translateAspect (value, errors) {
    if (value.hasValue) {
      return new AspectPropertyValue(null, this.translate(value.value, errors));
    }
    return new AspectPropertyValue(value.noValueMessage);
  }

  /**
   * Translate an array of strings or an array of weighted values. For weighted
   * values the weight and rawWeight are kept unchanged and only the value is
   * translated.
   *
   * @param {Array} values the array to translate
   * @param {Array} errors list to which any errors are added
   * @returns {Array} a new array of the same shape with translated values
   */
  translateArray (values, errors) {
    if (values.length > 0 && isWeightedValue(values[0])) {
      return values.map((item) => ({
        value: this.translateString(item.value, errors),
        weight: item.weight,
        rawWeight: item.rawWeight
      }));
    }
    return values.map((item) => this.translateString(item, errors));
  }

  /**
   * Translate a single string. This is the base translation that all other
   * forms ultimately call.
   *
   * @param {string} value the string to translate
   * @param {Array} errors list to which a not-found error is added when the
   * behaviour is FlowError
   * @returns {string} the translated string, or the behaviour-specific result
   * when no translation is found
   */
  translateString (value, errors) {
    const result = this.translations[String(value).toLowerCase()];
    if (result !== undefined && result !== null &&
      String(result).trim() !== '') {
      return result;
    }
    switch (this.behavior) {
      case MissingTranslationBehavior.EmptyString:
        return '';
      case MissingTranslationBehavior.FlowError:
        if (errors) {
          errors.push('There was no translation found for the value \'' +
            value + '\'.');
        }
        return null;
      case MissingTranslationBehavior.Original:
      default:
        return value;
    }
  }
}

module.exports = Translator;
