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

/**
 * @typedef {import('./translator')} Translator
 */

/**
 * Set of translators for one or more languages, with static helpers for
 * parsing Accept-Language headers and resolving language tags against the
 * available locales.
 */
class Languages {
  /**
   * Constructor.
   */
  constructor () {
    // Keyed on the original-case locale (e.g. 'fr_FR') so the matched locale
    // can be reported back exactly as it was registered.
    this.translators = {};
  }

  /**
   * Add a language and its translator to the set.
   *
   * @param {string} locale locale code for the language e.g. 'en_GB', 'fr_FR'
   * @param {Translator} translator translator for the language
   */
  addLanguage (locale, translator) {
    if (locale === null || locale === undefined || translator === null ||
      translator === undefined) {
      throw 'A locale and translator must be supplied.';
    }
    this.translators[locale] = translator;
  }

  /**
   * Get the translator and matched locale for the specified language, if one
   * is available.
   *
   * @param {string} language a locale code (e.g. 'fr_FR') or a full
   * Accept-Language header value (e.g. 'es,de-DE;q=0.8,en;q=0.5')
   * @returns {object|null} an object with `translator` and `matchedLocale`
   * properties, or null if no match was found
   */
  getTranslator (language) {
    const matched = Languages.tryResolveLocale(
      language, Object.keys(this.translators));
    if (matched !== null) {
      return { translator: this.translators[matched], matchedLocale: matched };
    }
    return null;
  }

  /**
   * Parse an Accept-Language header value (e.g. 'es,de-DE;q=0.8,en;q=0.5')
   * into an ordered list of normalized language tags. Tags are ordered by
   * quality (descending) with dashes replaced by underscores (e.g. 'en-GB'
   * becomes 'en_GB').
   *
   * @param {string} acceptLanguage the raw Accept-Language header value
   * @returns {Array<string>} ordered list of normalized tags, highest
   * preference first
   */
  static parseAcceptLanguage (acceptLanguage) {
    if (typeof acceptLanguage !== 'string' || acceptLanguage.trim() === '') {
      return [];
    }
    return acceptLanguage.split(',')
      .map((part, index) => {
        const segments = part.split(';');
        let quality = 1;
        for (let i = 1; i < segments.length; i++) {
          const segment = segments[i].trim();
          if (segment.toLowerCase().startsWith('q=')) {
            const parsed = parseFloat(segment.substring(2));
            if (!isNaN(parsed)) {
              quality = parsed;
            }
          }
        }
        return { value: segments[0], quality, index };
      })
      // Order by quality descending, keeping the original order for ties
      // (Array.prototype.sort is stable).
      .sort((a, b) => b.quality - a.quality || a.index - b.index)
      .map((item) => item.value.trim().replace(/-/g, '_'))
      .filter((value) => value !== '');
  }

  /**
   * Resolve an Accept-Language header value against a set of available locale
   * keys, returning the best matching locale. Handles both exact locale
   * matches (e.g. 'fr_FR') and 2-character language code fallbacks (e.g. 'fr'
   * matching 'fr_FR').
   *
   * If the highest-priority language matches the base language (default 'en')
   * resolution stops immediately and returns null, since the source values are
   * already in the base language and no translation is needed. This prevents
   * falling through to a lower-priority language.
   *
   * @param {string} acceptLanguage the raw Accept-Language header value
   * @param {Array<string>} availableLocales the available locale keys
   * @param {string} [baseLanguage] the 2-char code of the base language that
   * source values are already in; defaults to 'en'
   * @returns {string|null} the matched locale key (original case), or null
   */
  static tryResolveLocale (acceptLanguage, availableLocales, baseLanguage) {
    if (baseLanguage === undefined) {
      baseLanguage = 'en';
    }
    const candidates = Languages.parseAcceptLanguage(acceptLanguage);
    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();

      // Try an exact match first.
      const exact = availableLocales.find(
        (key) => key.toLowerCase() === lowerCandidate);
      if (exact !== undefined) {
        return exact;
      }

      // No exact match. If this candidate's language is the base language,
      // the source values are already in that language - stop and return null
      // rather than falling through to a lower-priority language.
      if (baseLanguage &&
        lowerCandidate.startsWith(baseLanguage.toLowerCase())) {
        return null;
      }

      // Try a 2-character language code fallback.
      if (candidate.length === 2) {
        const fallback = availableLocales.find(
          (key) => key.toLowerCase().startsWith(lowerCandidate));
        if (fallback !== undefined) {
          return fallback;
        }
      }
    }
    return null;
  }
}

module.exports = Languages;
