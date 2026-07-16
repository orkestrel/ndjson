import type { NDJSONParserInterface } from './types.js'
import { isRecord } from '@orkestrel/contract'

/**
 * A stateful NDJSON (newline-delimited JSON) stream parser — feed it string
 * chunks, get back the complete JSON objects decoded so far.
 *
 * @remarks
 * - **Partial-line buffering.** `parse(chunk)` appends `chunk` to an internal
 *   buffer, splits on `\n`, and emits every line BEFORE the last one (each one is
 *   `\n`-terminated, so it is complete); the final segment is the trailing partial
 *   line and is retained for the next call.
 * - **Records only, malformed-safe.** Each complete line is `JSON.parse`d inside a
 *   `try`/`catch`: a malformed line is silently skipped (never throws), and a
 *   non-object value is dropped — only plain records pass {@link isRecord}.
 */
export class NDJSONParser implements NDJSONParserInterface {
	#buffer = ''

	parse(chunk: string): readonly Record<string, unknown>[] {
		this.#buffer += chunk
		const lines = this.#buffer.split('\n')
		const records: Record<string, unknown>[] = []
		for (let index = 0; index < lines.length - 1; index += 1) {
			const line = lines[index]?.trim()
			if (line !== undefined && line.length > 0) {
				const record = this.#line(line)
				if (record !== undefined) records.push(record)
			}
		}
		this.#buffer = lines[lines.length - 1] ?? ''
		return records
	}

	reset(): void {
		this.#buffer = ''
	}

	#line(line: string): Record<string, unknown> | undefined {
		try {
			const value: unknown = JSON.parse(line)
			return isRecord(value) ? value : undefined
		} catch {
			return undefined
		}
	}
}
