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
const Languages = require('../languages');
const Translator = require('../translator');
const MissingTranslationBehavior = require('../missingTranslationBehavior');

/**
 * Accept-Language values are ordered by quality descending, dashes are
 * replaced by underscores and ties keep their original order.
 */
test('Languages - parseAcceptLanguage orders by quality', () => {
  const result = Languages.parseAcceptLanguage('es,de-DE;q=0.8,en;q=0.5');
  expect(result).toEqual(['es', 'de_DE', 'en']);
});

/**
 * An exact locale match wins.
 */
test('Languages - resolves an exact locale', () => {
  expect(Languages.tryResolveLocale('fr_FR', ['de_DE', 'fr_FR']))
    .toBe('fr_FR');
});

/**
 * A two letter language falls back to the first matching locale.
 */
test('Languages - resolves a two letter language', () => {
  expect(Languages.tryResolveLocale('fr', ['de_DE', 'fr_FR']))
    .toBe('fr_FR');
});

/**
 * English short-circuits resolution so lower priority languages are ignored.
 */
test('Languages - English short-circuits resolution', () => {
  expect(Languages.tryResolveLocale('en-GB,fr;q=0.5', ['fr_FR']))
    .toBeNull();
});

/**
 * A higher priority language is matched before a lower priority one.
 */
test('Languages - preferred language matched before lower priority', () => {
  expect(Languages.tryResolveLocale('es,de-DE;q=0.8,fr;q=0.5',
    ['de_DE', 'es_ES', 'fr_FR'])).toBe('es_ES');
});

/**
 * A weighted list of strings is translated with the weights preserved.
 */
test('Translator - preserves weights on a weighted list', () => {
  const translator = new Translator(
    { GB: 'United Kingdom', FR: 'France' },
    MissingTranslationBehavior.Original);
  const source = new AspectPropertyValue(null, [
    { value: 'GB', weight: 0.6, rawWeight: 39321 },
    { value: 'FR', weight: 0.4, rawWeight: 26214 }
  ]);
  const result = translator.translate(source, []);
  expect(result.hasValue).toBe(true);
  expect(result.value[0]).toEqual(
    { value: 'United Kingdom', weight: 0.6, rawWeight: 39321 });
  expect(result.value[1]).toEqual(
    { value: 'France', weight: 0.4, rawWeight: 26214 });
});

/**
 * When the behaviour is Original a missing translation returns the input.
 */
test('Translator - Original behaviour keeps the input on a miss', () => {
  const translator = new Translator(
    { GB: 'United Kingdom' }, MissingTranslationBehavior.Original);
  expect(translator.translate('Atlantis', [])).toBe('Atlantis');
});

/**
 * The no-value message is preserved when translating an empty
 * AspectPropertyValue.
 */
test('Translator - preserves the no-value message', () => {
  const translator = new Translator({}, MissingTranslationBehavior.Original);
  const source = new AspectPropertyValue('nothing here');
  const result = translator.translate(source, []);
  expect(result.hasValue).toBe(false);
  expect(result.noValueMessage).toBe('nothing here');
});
