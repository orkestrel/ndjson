/**
 * Represents a stateful NDJSON (newline-delimited JSON) stream parser: feed it string
 * chunks, get back the complete records decoded so far. A trailing partial
 * line is buffered until the rest arrives.
 */
export interface NDJSONParserInterface {
	/**
	 * Appends `chunk`, then returns every COMPLETE `\n`-terminated line parsed to a
	 * record (malformed / non-record lines are skipped); a trailing partial line
	 * is retained for the next call.
	 *
	 * @param chunk - Stream text appended to the internal buffer before splitting
	 * @returns Every complete line parsed to a record, in arrival order
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
