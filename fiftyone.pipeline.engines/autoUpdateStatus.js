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

const autoUpdateStatus = {
  // Update completed successfully.
  AUTO_UPDATE_SUCCESS: 'Success',
  // HTTPS connection could not be established.
  AUTO_UPDATE_HTTPS_ERR: 'HTTPS Error',
  // No need to perform update.
  AUTO_UPDATE_NOT_NEEDED: 'Update Not Needed',
  // Update currently under way.
  AUTO_UPDATE_IN_PROGRESS: 'In Progress',
  // Path to master file is directory not file
  AUTO_UPDATE_MASTER_FILE_CANT_RENAME: 'Cannot Rename Master File',
  // 51Degrees server responded with 429: too many attempts.
  AUTO_UPDATE_ERR_429_TOO_MANY_ATTEMPTS: '429 Too Many Attempts',
  // 51Degrees server responded with 403 meaning key is blacklisted.
  AUTO_UPDATE_ERR_403_FORBIDDEN: '403 Forbidden',
  // Used when IO operations with input or output stream failed.
  AUTO_UPDATE_ERR_READING_STREAM: 'Error Reading Stream',
  // MD5 validation failed
  AUTO_UPDATE_ERR_MD5_VALIDATION_FAILED: 'MD5 Validation Failed',
  // The new data file can't be renamed to replace the previous one.
  AUTO_UPDATE_NEW_FILE_CANT_RENAME: 'Cannot Rename New File',
  // Refreshing the engine with the new data caused an error to occur.
  AUTO_UPDATE_REFRESH_FAILED: 'Refresh Failed'
};

Object.freeze(autoUpdateStatus);
module.exports = autoUpdateStatus;
