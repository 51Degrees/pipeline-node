/**
 * The payload of the OWID envelope in a base 64 string, or null where the
 * string does not hold exactly one structurally valid envelope.
 * @param {*} value what was offered as a 51Did
 * @returns {Uint8Array|null} a copy of the payload bytes, or null
 */
export function payloadOf(value: any): Uint8Array | null;
