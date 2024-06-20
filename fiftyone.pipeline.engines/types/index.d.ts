export let AspectData: typeof import("./aspectData");
export let AspectDataDictionary: typeof import("./aspectDataDictionary");
export let DataFile: typeof import("./dataFile");
export let DataKeyedCache: typeof import("./dataKeyedCache");
export let Engine: typeof import("./engine");
export let Lru: typeof import("./lru");
export let LruCache: typeof import("./lruCache");
export let MissingPropertyService: typeof import("./missingPropertyService");
export let DataFileUpdateService: typeof import("./dataFileUpdateService");
export let AutoUpdateStatus: {
    AUTO_UPDATE_SUCCESS: string;
    AUTO_UPDATE_HTTPS_ERR: string;
    AUTO_UPDATE_NOT_NEEDED: string;
    AUTO_UPDATE_IN_PROGRESS: string;
    AUTO_UPDATE_MASTER_FILE_CANT_RENAME: string;
    AUTO_UPDATE_ERR_429_TOO_MANY_ATTEMPTS: string;
    AUTO_UPDATE_ERR_403_FORBIDDEN: string;
    AUTO_UPDATE_ERR_READING_STREAM: string;
    AUTO_UPDATE_ERR_MD5_VALIDATION_FAILED: string;
    AUTO_UPDATE_NEW_FILE_CANT_RENAME: string;
    AUTO_UPDATE_REFRESH_FAILED: string;
};
export let Tracker: typeof import("./tracker");
