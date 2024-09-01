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

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');
const EventEmitter = require('events');

const AutoUpdateStatus = require('./autoUpdateStatus');

const minToMs = (min) => min * 60000;

/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('./dataFile')} DataFile
 */

/**
 * Datafiles attached to FlowElements register with
 * the dataFileUpdateService so the datafiles can receive
 * automatic updates
 **/
class DataFileUpdateService {
  /**
   * Constructor for a DataFileUpdateService
   *
   * @param {Pipeline} [pipeline]
   * pipeline the update service is attached to
   **/
  constructor (pipeline) {
    this.registerPipeline(pipeline);
    /**
     * @type {EventEmitter}
     */
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Method to register a pipeline with the update service
   *
   * @param {Pipeline} [pipeline] Pipeline to register
   */
  registerPipeline (pipeline) {
    this.pipeline = pipeline;
  }

  /**
   * EventEmitter's 'on' delegation
   *
   * @param {string | symbol}  listener listener
   * @param {Function} callback callback
   */
  on (listener, callback) {
    this.eventEmitter.on(listener, callback);
  }

  /**
   * EventEmitter's 'once' delegation
   *
   * @param {string | symbol} listener listener
   * @param {Function} callback callback
   */
  once (listener, callback) {
    this.eventEmitter.once(listener, callback);
  }

  /**
   * Method that updates a datafile when it is due an update
   *
   * @param {DataFile} dataFile the datafile to update
   * @returns {boolean | void} returns false if already updating
   * or request failed
   */
  updateDataFile (dataFile) {
    const dataFileUpdateService = this;
    dataFile.attemptedDownload = true;

    if (dataFile.updating) {
      return false;
    } else {
      dataFile.updating = true;
    }

    const urlParts = new url.URL(dataFile.updateUrl);

    const requestOptions = urlParts;

    if (dataFile.verifyIfModifiedSince) {
      try {
        requestOptions.headers = {
          'If-Modified-Since': dataFile.getDatePublished().toUTCString()
        };
      } catch (e) {
        // getPublished might not exist if no datafile
      }
    }

    let request;

    if (urlParts.protocol === 'https:') {
      request = https.get(requestOptions);
    } else {
      request = http.get(requestOptions);
    }

    request.on('response', function (response) {
      if (response.statusCode !== 200) {
        dataFile.updating = false;

        switch (response.statusCode) {
          case (429):
            dataFileUpdateService.pipeline.log(
              'error',
              "Too many requests to '" + dataFile.updateUrl +
              "' for engine '" +
              dataFile.flowElement.dataKey + "'");
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_ERR_429_TOO_MANY_ATTEMPTS,
              dataFile);
            break;
          case (304):
            dataFileUpdateService.pipeline.log(
              'warn',
              'No data update available from ' +
              dataFile.updateUrl +
              "' for engine '" +
              dataFile.flowElement.dataKey + "'");
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED,
              dataFile);
            break;
          case (403):
            dataFileUpdateService.pipeline.log('error',
              'Access denied from ' +
              dataFile.updateUrl +
              "' for engine '" +
              dataFile.flowElement.dataKey + "'");
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_ERR_403_FORBIDDEN,
              dataFile);
            break;
          default:
            dataFileUpdateService.pipeline.log(
              'error',
              'Error' + response.statusCode +
              ' from ' +
              dataFile.updateUrl +
              "' for engine '" +
              dataFile.flowElement.dataKey + "'");
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR,
              dataFile);
            break;
        }

        dataFileUpdateService.checkNextUpdate(dataFile);

        return false;
      };

      const filename = dataFile.tempDataDirectory +
        '/' + dataFile.identifier +
        Date.now();
      response.pipe(fs.createWriteStream(filename));

      response.on('end', function () {
        // Open file
        if (dataFile.verifyMD5) {
          const headerMD5 = response.headers['content-md5'];

          const fd = fs.createReadStream(filename);

          const hash = crypto.createHash('md5');
          hash.setEncoding('hex');

          fd.on('end', function () {
            hash.end();
            if (hash.read() !== headerMD5) {
              dataFileUpdateService.pipeline.log(
                'error',
                "MD5 doesn't match from '" +
                dataFile.updateUrl +
                "' for engine '" +
                dataFile.flowElement.dataKey +
                "'");

              dataFile.updating = false;
              dataFileUpdateService.checkNextUpdate(dataFile);
              dataFileUpdateService.eventEmitter.emit(
                'updateComplete',
                AutoUpdateStatus.AUTO_UPDATE_ERR_MD5_VALIDATION_FAILED,
                dataFile);
            } else {
              dataFileUpdateService.processFile(dataFile, filename);
            }
          });

          fd.pipe(hash);
        } else {
          dataFileUpdateService.processFile(dataFile, filename);
        }
      });
    });
  }

  /**
   * Internal method called when the datafile has
   * been downloaded and is ready after an update
   *
   * @param {DataFile} dataFile the datafile that is ready
   * @param {string} filename the filename of the updated datafile
   * @returns {void}
   */
  fileReady (dataFile, filename) {
    const dataFileUpdateService = this;

    fs.readFile(filename, function (err, data) {
      if (err) {
        dataFileUpdateService.pipeline.log('error', err);
        dataFileUpdateService.eventEmitter.emit(
          'updateComplete',
          AutoUpdateStatus.AUTO_UPDATE_MASTER_FILE_CANT_RENAME,
          dataFile);
      }

      fs.writeFile(dataFile.path, data, function (err) {
        if (err) {
          dataFileUpdateService.pipeline.log('error', err);
          dataFileUpdateService.eventEmitter.emit(
            'updateComplete',
            AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME,
            dataFile);
        }

        try {
          dataFile.refresh();
        } catch (e) {
          dataFileUpdateService.pipeline.log('error', e);
          dataFileUpdateService.eventEmitter.emit(
            'updateComplete',
            AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED,
            dataFile);
        }
        dataFileUpdateService.checkNextUpdate(dataFile);
        dataFile.updating = false;

        // Delete the temp file
        fs.unlink(filename, function (err) {
          if (err) {
            dataFileUpdateService.pipeline.log('error', err);
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME,
              dataFile);
          }
          dataFileUpdateService.eventEmitter.emit(
            'updateComplete',
            AutoUpdateStatus.AUTO_UPDATE_SUCCESS,
            dataFile);
        });
      });
    });
  }

  /**
   * Internal method to process the datafile has been downloaded
   * Including unzipping if needed
   *
   * @param {DataFile} dataFile the datafile to processs
   * @param {string} filename the filename of the downloaded data
   */
  processFile (dataFile, filename) {
    const dataFileUpdateService = this;

    if (dataFile.decompress) {
      fs.readFile(filename, function (err, buffer) {
        if (err) {
          dataFileUpdateService.pipeline.log('error', err);
          dataFileUpdateService.eventEmitter.emit(
            'updateComplete',
            AutoUpdateStatus.AUTO_UPDATE_ERR_READING_STREAM,
            dataFile);
        }

        zlib.gunzip(buffer, function (err, data) {
          if (err) {
            dataFileUpdateService.pipeline.log('error', err);
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_ERR_READING_STREAM,
              dataFile);
          }

          const doneFileName = filename + '_done';

          fs.writeFile(doneFileName, data, function () {
            dataFileUpdateService.fileReady(dataFile, doneFileName);
            fs.unlink(filename, function (err) {
              if (err) dataFileUpdateService.pipeline.log('error', err);
            });
          });
        });
      });
    } else {
      dataFileUpdateService.fileReady(dataFile, filename);
    }
  }

  /**
   * Internal method to check the next update of a
   * datafile at a polling interval set on the datafile
   *
   * @param {DataFile} dataFile the datafile to check updates for
   */
  checkNextUpdate (dataFile) {
    try {
      const dataFileUpdateService = this;

      // Run update on start if specified to do so
      if (dataFile.updateOnStart && !dataFile.attemptedDownload) {
        dataFileUpdateService.updateDataFile(dataFile);
        return;
      }

      if (dataFile.autoUpdate) {
        let interval = minToMs(
          (Math.floor(Math.random() *
              dataFile.updateTimeMaximumRandomisation) +
            1) +
          dataFile.pollingInterval
        );

        interval += dataFile.getNextUpdate().getMilliseconds();
        setTimeout(function () {
          dataFileUpdateService.updateDataFile(dataFile);
        }, interval);
      }
    } catch (e) {
      // Catch any extra errors with datafile updates
      this.pipeline.log('error', e);
    }
  }

  /**
   * Method that registers a datafile with the update service
   *
   * @param {DataFile} dataFile the datafile to register
   */
  registerDataFile (dataFile) {
    dataFile.registered = true;
    if (dataFile.updateOnStart) {
      this.updateDataFile(dataFile);
    } else {
      if (dataFile.autoUpdate) {
        this.checkNextUpdate(dataFile);
      }
    }

    // check if fileSystemWatcher is enabled and listen for datafile changes

    if (dataFile.fileSystemWatcher) {
      const dataFileUpdateService = this;
      const watch = function () {
        fs.watch(dataFile.path, { persistent: false }, function (event) {
          if (!dataFile.updating) {
            dataFile.refresh();
            dataFileUpdateService.eventEmitter.emit(
              'updateComplete',
              AutoUpdateStatus.AUTO_UPDATE_SUCCESS,
              dataFile);
          }
        });
      };

      if (fs.existsSync(dataFile.path)) {
        watch();
      } else {
        const checkWatcherCanStart = setInterval(function () {
          try {
            watch();

            clearInterval(checkWatcherCanStart);
          } catch (e) {

          }
        }, 500);
      }
    }
  }
}

module.exports = DataFileUpdateService;
