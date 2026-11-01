import type { NDJSONParserInterface, NDJSONParserOptions } from './types.js'
import { isRecord, parseJSON } from '@orkestrel/contract'
import { NDJSONError } from './errors.js'

/**
 * Decodes an NDJSON (newline-delimited JSON) stream statefully, implementing
 * {@link NDJSONParserInterface} over a private buffer the instance owns — each `parse`
 * call returns the records completed so far and reassembles a record split across
 * chunk boundaries.
 *
 * @remarks
 * - **Partial-line buffering.** `parse(chunk)` appends `chunk` to the buffer, splits
 *   on `\n`, and emits every line before the last one, each of them `\n`-terminated
 *   and so complete; the final segment is the trailing partial line.
 * - **Records only.** Each complete line is trimmed, a blank line is skipped, and the
 *   rest is decoded through `parseJSON` and kept only when it passes {@link isRecord}.
 *   By default a malformed line or a non-record value is skipped and `parse` never
 *   throws. A strict parser throws an `NDJSONError` instead — `'SYNTAX'` for a line that
 *   is not valid JSON, `'RECORD'` for one that is not a plain record — and the throwing
 *   call returns no record and leaves the parser cleared, as `clear()` leaves it.
 *
 * @example
 * ```ts
 * import { NDJSONParser } from '@orkestrel/ndjson'
 *
 * const parser = new NDJSONParser()
 * parser.parse('{"a":1}\n{"b"') // [{ a: 1 }] - the second line is still partial
 * parser.parse(':2}\n') // [{ b: 2 }] - the split line reassembled
 * parser.clear() // drop any buffered partial - ready for a fresh stream
 * ```
 */
export class NDJSONParser implements NDJSONParserInterface {
	readonly #strict: boolean
	#buffer = ''

	/**
	 * Creates a parser with an empty buffer.
	 *
	 * @param options - The parser options; `strict` refuses a complete line that is not a
	 *   JSON object. Default: a lenient parser
	 */
	constructor(options?: NDJSONParserOptions) {
		this.#strict = options?.strict === true
	}

	parse(chunk: string): ReadonlyArray<Record<string, unknown>> {
		const lines = (this.#buffer + chunk).split('\n')
		this.#buffer = ''
		const records = lines.slice(0, -1).flatMap((text) => this.#decode(text))
		this.#buffer = lines.at(-1) ?? ''
		return records
	}

	clear(): void {
		this.#buffer = ''
	}

	#decode(text: string): ReadonlyArray<Record<string, unknown>> {
		const line = text.trim()
		if (line.length === 0) return []
		const value = parseJSON(line)
		if (isRecord(value)) return [value]
		if (!this.#strict) return []
		if (value === undefined)
			throw new NDJSONError(
				'SYNTAX',
				'NDJSON line is not valid JSON; each line must hold one JSON object',
			)
		throw new NDJSONError(
			'RECORD',
			'NDJSON line is valid JSON but not an object; each line must hold one JSON object',
		)
	}
}
