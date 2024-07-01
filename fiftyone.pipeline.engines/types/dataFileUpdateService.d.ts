export = DataFileUpdateService;
/**
 * @typedef {import('./dataFile')} DataFile
 */
/**
 * Datafiles attached to FlowElements register with
 * the dataFileUpdateService so the datafiles can receive
 * automatic updates
 **/
declare class DataFileUpdateService {
    /**
     * Constructor for a DataFileUpdateService
     *
     * @param {EventEmitter=} pipelineEmitter
     * pipelineEmitter the update service is attached to
     **/
    constructor(pipelineEmitter?: EventEmitter | undefined);
    eventEmitter: EventEmitter;
    /**
     * Register emmiter to get human readable statuses
     *
     * @param {EventEmitter} pipelineEmitter event emiiter for human readable statuses
     */
    registerPipelineEmmiter(pipelineEmitter: EventEmitter): void;
    pipelineEmitter: EventEmitter;
    /**
     * EventEmitter's 'on' delegation
     *
     * @param {string | symbol}  listener listener
     * @param {Function} callback callback
     */
    on(listener: string | symbol, callback: Function): void;
    /**
     * EventEmitter's 'once' delegation
     *
     * @param {string | symbol} listener listener
     * @param {Function} callback callback
     */
    once(listener: string | symbol, callback: Function): void;
    /**
     * Method that updates a datafile when it is due an update
     *
     * @param {DataFile} dataFile the datafile to update
     * @returns {boolean} returns false if already updating
     * or request failed
     */
    updateDataFile(dataFile: DataFile): boolean;
    /**
     * Internal method called when the datafile has
     * been downloaded and is ready after an update
     *
     * @param {DataFile} dataFile the datafile that is ready
     * @param {string} filename the filename of the updated datafile
     */
    fileReady(dataFile: DataFile, filename: string): void;
    /**
     * Internal method to process the datafile has been downloaded
     * Including unzipping if needed
     *
     * @param {DataFile} dataFile the datafile to processs
     * @param {string} filename the filename of the downloaded data
     */
    processFile(dataFile: DataFile, filename: string): void;
    /**
     * Internal method to check the next update of a
     * datafile at a polling interval set on the datafile
     *
     * @param {DataFile} dataFile the datafile to check updates for
     */
    checkNextUpdate(dataFile: DataFile): void;
    /**
     * Method that registers a datafile with the update service
     *
     * @param {DataFile} dataFile the datafile to register
     */
    registerDataFile(dataFile: DataFile): void;
}
declare namespace DataFileUpdateService {
    export { DataFile };
}
import EventEmitter = require("events");
type DataFile = import('./dataFile');
