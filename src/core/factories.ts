import type { NDJSONParserInterface, NDJSONParserOptions } from './types.js'
import { NDJSONParser } from './NDJSONParser.js'

/**
 * Creates an NDJSON (newline-delimited JSON) stream parser and returns it as an
 * {@link NDJSONParserInterface} — a fresh {@link NDJSONParser} holding the buffer,
 * so a caller holds the published contract rather than the class.
 *
 * @param options - The parser options; `strict: false` skips a complete line that is not a
 *   JSON object. Default: a strict parser
 * @returns A working {@link NDJSONParserInterface}
 *
 * @example Create a parser
 * ```ts
 * import { createNDJSONParser } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser()
 * parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
 * parser.parse('{"c":3}') // [] — buffered until its trailing newline arrives
 * parser.parse('\n') // [{ c: 3 }]
 * ```
 *
 * @example Refuse a line
 * ```ts
 * import { createNDJSONParser, isNDJSONError } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser()
 * parser.parse('{"a":1}\n\n') // [{ a: 1 }] - a blank line is skipped
 * try {
 * 	parser.parse('[1,2]\n{"b"')
 * } catch (error) {
 * 	if (isNDJSONError(error)) error.code // 'RECORD'
 * }
 * parser.parse('\n') // [] - the refusal dropped the partial line
 * parser.parse('{"b":2}\n') // [{ b: 2 }]
 * ```
 *
 * @example Create a lenient parser
 * ```ts
 * import { createNDJSONParser } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser({ strict: false })
 * parser.parse('not json\n\n{"a":1}\n[1,2]\n') // [{ a: 1 }] - malformed, blank, and non-record lines skipped
 * ```
 */
export function createNDJSONParser(options?: NDJSONParserOptions): NDJSONParserInterface {
	return new NDJSONParser(options)
}
