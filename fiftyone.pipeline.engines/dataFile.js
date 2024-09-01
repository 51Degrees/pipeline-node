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

const os = require('os');

/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * A datafile used by a FlowElement / Engine to get calculate properties values
 */
class DataFile {
  /**
   * Constructor for Data File
   *
   * @param {object} options the options for the data file
   * @param {FlowElement} options.flowElement
   * The FlowElement using the datafile
   * @param {string} options.identifier
   * Name of the datafile
   * @param {object} options.updateURLParams
   * Parameters used to construct the datafile update url
   * if autoupdate is set to true
   * @param {string} options.tempDataDirectory
   * temporary file location (defaults to the operating system defualt)
   * @param {boolean} options.createTempDataCopy
   * whether to copy datafile to temporary location when updating
   * @param {*} options.data data, if the file is stored in memory
   * @param {string} options.path path to the datafile
   * @param {boolean} options.autoUpdate whether to automatically
   * update the datafile when required
   * @param {boolean} options.fileSystemWatcher
   * whether to check the datafile's path for changes and
   * update the connected FlowElement's data automatically
   * when the file is changed in the operating system
   * @param {number} options.pollingInterval How often to poll for
   * updates to the datafile (minutes)
   * @param {number} options.updateTimeMaximumRandomisation
   * Maximum randomisation offset in seconds to polling time interval
   * @param {boolean} options.verifyMD5 whether to check a 'content-md5'
   *  header in the data file update service against the datafile
   * to verify its contents
   * @param {boolean} options.decompress is the datafile gziped
   * when returning from the update service?
   * @param {boolean} options.download should the datafile be
   * downloaded or stored in memory
   * @param {Function} options.getDatePublished function for getting
   * the published date of the datafile
   * @param {Function} options.getNextUpdate function for getting the
   * next available update from the datafile
   * @param {boolean} options.verifyIfModifiedSince whether to check
   * an "If-Modified-Since" header on the update service against
   * the last datafile update date
   * @param {boolean} options.updateOnStart whether to update the
   * datafile as soon as it is initialised
   * @param {boolean} options.isRegistered whether the datafile has already
   *  been registered with a datafile update service (defaults to false)
   * @param {Function} options.refresh callback to call when datafile
   * has been updated. Defaults to a refresh method on the attached FlowElement
   *
   */
  constructor (
    {
      flowElement,
      identifier,
      updateURLParams,
      tempDataDirectory = os.tmpdir(),
      createTempDataCopy = true,
      data,
      path,
      autoUpdate = true,
      fileSystemWatcher = true,
      pollingInterval = 30,
      updateTimeMaximumRandomisation = 10,
      verifyMD5 = true,
      decompress = true,
      download = true,
      getDatePublished,
      getNextUpdate,
      verifyIfModifiedSince = true,
      updateOnStart = false,
      isRegistered = false,
      refresh
    }) {
    this.flowElement = flowElement;
    this.identifier = identifier;
    this.updateURLParams = updateURLParams;
    this.tempDataDirectory = tempDataDirectory;
    this.createTempDataCopy = createTempDataCopy;
    this.data = data;
    this.path = path;
    this.autoUpdate = autoUpdate;
    this.fileSystemWatcher = fileSystemWatcher;
    this.pollingInterval = pollingInterval;
    this.updateTimeMaximumRandomisation = updateTimeMaximumRandomisation;
    this.verifyMD5 = verifyMD5;
    this.decompress = decompress;
    this.download = download;
    this.getDatePublished = getDatePublished;
    this.getNextUpdate = getNextUpdate;
    this.verifyIfModifiedSince = verifyIfModifiedSince;
    this.updateOnStart = updateOnStart;
    this.isRegistered = isRegistered;
    this.attemptedDownload = false;

    if (refresh) {
      this.refresh = refresh;
    }

    if (path) {
      this.path = path;
    } else if (data) {
      this.data = data;
    }

    // Flag for whether the datafile is currently being updated
    this.updating = false;
  }

  /**
   * Function called when datafile has been updated.
   * Defaults to a refresh method on the attached FlowElement
   * Can also be overriden by a refresh paramater in the
   * options of the constructor
   *
   * @param {string} identifier the identifier of the datafile
   */
  refresh (identifier) {
    this.flowElement.refresh(identifier);
  }

  /**
   * Getter for the update url for the datafile update service to use
   *
   * @returns {string} url
   */
  get updateUrl () {
    return this.urlFormatter();
  }

  /**
   * Function that constructs the url for the datafile update service to use
   *
   * @returns {string} url
   */
  urlFormatter () {
    // by default just return the url
    return this.updateURLParams.url;
  }
}

module.exports = DataFile;
