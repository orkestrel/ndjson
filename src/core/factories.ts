import type { NDJSONParserInterface } from './types.js'
import { NDJSONParser } from './NDJSONParser.js'

/**
 * Create an NDJSON (newline-delimited JSON) stream parser - a stateful handle
 * that turns string chunks into the complete JSON objects decoded so far.
 *
 * @returns A working {@link NDJSONParserInterface}
 *
 * @example
 * ```ts
 * import { createNDJSONParser } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser()
 * parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
 * parser.parse('{"c":3}') // [] - buffered until its trailing newline arrives
 * parser.parse('\n') // [{ c: 3 }]
 * ```
 */
export function createNDJSONParser(): NDJSONParserInterface {
	return new NDJSONParser()
}
