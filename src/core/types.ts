/**
 * Represents the stateful NDJSON (newline-delimited JSON) stream-parser contract a
 * consumer holds — a `parse` that turns each string chunk into the complete records
 * decoded so far, and a `clear` that drops the buffered partial line.
 */
export interface NDJSONParserInterface {
	/**
	 * Appends `chunk` to the buffer and returns every complete `\n`-terminated line
	 * parsed to a record, skipping a malformed or non-record line unless the parser is
	 * strict; the trailing partial line is retained for the next call unless a strict
	 * refusal in the same call clears the buffer, so a line split across a chunk boundary
	 * is reassembled when its closing `\n` arrives.
	 *
	 * @remarks
	 * A line the stream never terminates stays in the buffer until its newline arrives,
	 * unless a strict refusal in the same call clears the buffer, and the buffer has no
	 * size limit, so a caller fronting an untrusted or unbounded upstream must enforce its
	 * own byte cap before feeding chunks in.
	 *
	 * @param chunk - Stream text appended to the internal buffer before splitting
	 * @returns Every complete line parsed to a record, in arrival order
	 * @throws {NDJSONError} Thrown when the parser is strict and a complete line is not
	 *   valid JSON (`'SYNTAX'`) or not a plain record (`'RECORD'`); the call returns no
	 *   record, discards the lines after the refused one, and leaves the parser cleared.
	 */
	parse(chunk: string): ReadonlyArray<Record<string, unknown>>
	/**
	 * Drops any buffered partial line, leaving the handle ready for a fresh
	 * stream.
	 *
	 * @returns Nothing
	 */
	clear(): void
}

/**
 * Configures the parser `createNDJSONParser` builds and the `NDJSONParser` constructor
 * accepts — `strict` decides whether a complete line that is not a JSON object is skipped
 * or refused.
 *
 * @remarks
 * If `true`, `parse` throws an `NDJSONError` on a complete line that is not valid JSON or
 * not a plain record; if `false`, `parse` skips that line. Default: `false`.
 */
export interface NDJSONParserOptions {
	readonly strict?: boolean
}

/**
 * Names the machine-readable code an `NDJSONError` carries — `'SYNTAX'` for a complete
 * line that is not valid JSON, and `'RECORD'` for a complete line that is valid JSON but
 * not a plain record.
 */
export type NDJSONErrorCode = 'SYNTAX' | 'RECORD'
