/**
 * Represents the stateful NDJSON (newline-delimited JSON) stream-parser contract a
 * consumer holds — a `parse` that turns each string chunk into the complete records
 * decoded so far, and a `clear` that drops the buffered partial line.
 */
export interface NDJSONParserInterface {
	/**
	 * Appends `chunk` to the buffer and returns every complete `\n`-terminated line
	 * parsed to a record, skipping a malformed or non-record line; the trailing partial
	 * line is retained for the next call, so a line split across a chunk boundary is
	 * reassembled when its closing `\n` arrives.
	 *
	 * @remarks
	 * A line the stream never terminates stays in the buffer until its newline arrives,
	 * and the buffer has no size limit, so a caller fronting an untrusted or unbounded
	 * upstream must enforce its own byte cap before feeding chunks in.
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
