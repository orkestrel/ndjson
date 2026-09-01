/**
 * A stateful NDJSON (newline-delimited JSON) stream parser: feed it string
 * chunks, get back the complete JSON objects decoded so far. A trailing partial
 * line is buffered until the rest arrives.
 */
export interface NDJSONParserInterface {
	/**
	 * Append `chunk`, then return every COMPLETE `\n`-terminated line parsed to a
	 * record (malformed / non-object lines are skipped); a trailing partial line
	 * is retained for the next call.
	 *
	 * @param chunk - Stream text appended to the internal buffer before splitting
	 * @returns Every complete line parsed to a record, in arrival order
	 */
	parse(chunk: string): ReadonlyArray<Record<string, unknown>>
	/**
	 * Drop any buffered partial line - reset for a fresh stream.
	 *
	 * @returns Nothing
	 */
	reset(): void
}
