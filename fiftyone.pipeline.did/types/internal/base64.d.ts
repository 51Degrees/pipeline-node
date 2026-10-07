/**
 * The standard alphabet, padded form of base 64 written in either
 * alphabet, which is what `atob` and the OWID library read. A 51Did is
 * issued in the standard alphabet with padding, and a page that puts one
 * in a link uses the URL safe alphabet without it. Every reader of a 51Did
 * normalises through here.
 * @param {string} value base 64 in either alphabet, with or without padding
 * @returns {string} the standard alphabet form, padded
 */
export function toStandardBase64(value: string): string;
