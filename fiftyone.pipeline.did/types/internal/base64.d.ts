/**
 * The standard alphabet, padded form of base 64 written in either
 * alphabet. A 51Did is issued in the standard alphabet with padding, and a
 * page that puts one in a link uses the URL safe alphabet without it.
 * Every reader of a 51Did normalises through here.
 *
 * Written by hand because the package runs in a browser as well as in
 * Node. A browser has no `Buffer`, which reads both alphabets, and its
 * `atob` refuses the URL safe one. `Uint8Array.fromBase64` is in newer
 * browsers and not in Node 24. `atob` needs no padding, which is added
 * because `FodId.toStandardBase64` answers with the form the cloud issues.
 * @param {string} value base 64 in either alphabet, with or without padding
 * @returns {string} the standard alphabet form, padded
 */
export function toStandardBase64(value: string): string;
