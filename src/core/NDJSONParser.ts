import type { NDJSONParserInterface } from './types.js'
import { isRecord, parseJSONAs } from '@orkestrel/contract'

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
 * - **Records only, malformed-safe.** Each complete line is parsed through
 *   `parseJSONAs(line, isRecord)`: a malformed line is silently skipped rather than
 *   thrown, and a non-record value is dropped — only plain records pass
 *   {@link isRecord}.
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
	#buffer = ''

	parse(chunk: string): ReadonlyArray<Record<string, unknown>> {
		this.#buffer += chunk
		const lines = this.#buffer.split('\n')
		const records: Array<Record<string, unknown>> = []
		for (let index = 0; index < lines.length - 1; index += 1) {
			const line = lines[index]?.trim()
			if (line !== undefined && line.length > 0) {
				const record = parseJSONAs(line, isRecord)
				if (record !== undefined) records.push(record)
			}
		}
		this.#buffer = lines[lines.length - 1] ?? ''
		return records
	}

	clear(): void {
		this.#buffer = ''
	}
}
