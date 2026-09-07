import type { NDJSONParserInterface } from './types.js'
import { NDJSONParser } from './NDJSONParser.js'

/**
 * Creates an NDJSON (newline-delimited JSON) stream parser and returns it as an
 * `NDJSONParserInterface` — a fresh `NDJSONParser` holding the buffer, so a caller
 * holds the published contract rather than the class.
 *
 * @returns A working {@link NDJSONParserInterface}
 *
 * @example Factories
 * ```ts
 * import { createNDJSONParser } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser()
 * parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
 * ```
 */
export function createNDJSONParser(): NDJSONParserInterface {
	return new NDJSONParser()
}
