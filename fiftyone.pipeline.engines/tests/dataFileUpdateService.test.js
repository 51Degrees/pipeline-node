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
const path = require('path');
const net = require('net');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

/**
 * A request that fails at the connection level (for example reset by
 * the server) must report the failure through the updateComplete event
 * rather than crashing the process with an unhandled 'error' event.
 */
test('data file update connection failure emits updateComplete', done => {
  // A server that accepts the connection and immediately destroys the
  // socket, so the client receives a reset instead of a response.
  const server = net.createServer(function (socket) {
    socket.destroy();
  });

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port;

    const updateService = new DataFileUpdateService({
      log: function () {}
    });

    // Minimal stand-in for a DataFile. autoUpdate false keeps
    // checkNextUpdate from scheduling a retry timer after the failure.
    const dataFile = {
      updateUrl: 'http://127.0.0.1:' + port + '/datafile',
      verifyIfModifiedSince: false,
      autoUpdate: false,
      updateOnStart: false,
      attemptedDownload: false,
      updating: false,
      flowElement: { dataKey: 'testEngine' }
    };

    updateService.once('updateComplete', function (status, file) {
      server.close(function () {
        expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
        expect(file).toBe(dataFile);
        expect(file.updating).toBe(false);
        done();
      });
    });

    updateService.updateDataFile(dataFile);
  });
});
