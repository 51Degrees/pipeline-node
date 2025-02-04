/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2025 51 Degrees Mobile Experts Limited, Davidson House,
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

module.exports = {
  cloudNoPropertiesAccess: ' This is because your resource key does not ' +
    'include access to any properties under "%s". For more details, see our ' +
    'resource key explainer: ' +
    'https://51degrees.com/documentation/_info__resource_keys.html',
  cloudNoPropertyAccess: ' This is because your resource key does not ' +
    'include access to this property. Properties that are included for this ' +
    'key under "%s" are %s. For more details on resource keys, see our ' +
    'explainer: ' +
    'https://51degrees.com/documentation/_info__resource_keys.html',
  cloudReasonUnknown: ' The reason for this is unknown as the supplied ' +
    'resource key does appear to allow access to this property.',
  propertyExcluded: 'Property "%s" is not present in the results. This ' +
    'is because the property has been excluded when configuring the engine.'
};
