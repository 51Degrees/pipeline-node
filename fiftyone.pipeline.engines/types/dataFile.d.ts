export = DataFile;
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */
/**
 * A datafile used by a FlowElement / Engine to get calculate properties values
 */
declare class DataFile {
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
    constructor({ flowElement, identifier, updateURLParams, tempDataDirectory, createTempDataCopy, data, path, autoUpdate, fileSystemWatcher, pollingInterval, updateTimeMaximumRandomisation, verifyMD5, decompress, download, getDatePublished, getNextUpdate, verifyIfModifiedSince, updateOnStart, isRegistered, refresh }: {
        flowElement: FlowElement;
        identifier: string;
        updateURLParams: object;
        tempDataDirectory: string;
        createTempDataCopy: boolean;
        data: any;
        path: string;
        autoUpdate: boolean;
        fileSystemWatcher: boolean;
        pollingInterval: number;
        updateTimeMaximumRandomisation: number;
        verifyMD5: boolean;
        decompress: boolean;
        download: boolean;
        getDatePublished: Function;
        getNextUpdate: Function;
        verifyIfModifiedSince: boolean;
        updateOnStart: boolean;
        isRegistered: boolean;
        refresh: Function;
    });
    flowElement: import("fiftyone.pipeline.core/types/flowElement");
    identifier: string;
    updateURLParams: object;
    tempDataDirectory: string;
    createTempDataCopy: boolean;
    data: any;
    path: string;
    autoUpdate: boolean;
    fileSystemWatcher: boolean;
    pollingInterval: number;
    updateTimeMaximumRandomisation: number;
    verifyMD5: boolean;
    decompress: boolean;
    download: boolean;
    getDatePublished: Function;
    getNextUpdate: Function;
    verifyIfModifiedSince: boolean;
    updateOnStart: boolean;
    isRegistered: boolean;
    attemptedDownload: boolean;
    /**
     * Function called when datafile has been updated.
     * Defaults to a refresh method on the attached FlowElement
     * Can also be overriden by a refresh paramater in the
     * options of the constructor
     *
     * @param {string} identifier the identifier of the datafile
     */
    refresh(identifier: string): void;
    updating: boolean;
    /**
     * Getter for the update url for the datafile update service to use
     *
     * @returns {string} url
     */
    get updateUrl(): string;
    /**
     * Function that constructs the url for the datafile update service to use
     *
     * @returns {string} url
     */
    urlFormatter(): string;
}
declare namespace DataFile {
    export { FlowElement };
}
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
