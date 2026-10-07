/**
 * The payload of the OWID envelope in a base 64 string, or null where the
 * value does not hold exactly one structurally valid envelope. The string
 * is decoded as the OWID library decodes it, so both readers accept the
 * same strings.
 * @param {*} value what was offered as a 51Did
 * @returns {Uint8Array|null} the payload bytes, or null
 */
export function payloadOf(value: any): Uint8Array | null;
