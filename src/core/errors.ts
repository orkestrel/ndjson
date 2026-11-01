import type { NDJSONErrorCode } from './types.js'
import { holds, INTRINSICS, isInstance } from '@orkestrel/contract'

/**
 * Represents the refusal of a complete NDJSON line by a strict parser, carrying the
 * machine-readable `NDJSONErrorCode` a `catch` branches on.
 *
 * @remarks
 * - **Codes.** `'SYNTAX'` marks a complete line that is not valid JSON; `'RECORD'` marks a
 *   complete line that is valid JSON but not a plain record.
 * - **The refusing call.** The `parse` call that throws returns no record: it discards every
 *   line it holds, the lines after the refused one included, and leaves the parser cleared,
 *   as `clear()` leaves it.
 * - **Fixed message.** The message states what each line must hold and quotes no text from
 *   the refused line.
 *
 * @example
 * ```ts
 * import { createNDJSONParser, isNDJSONError } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser({ strict: true })
 * try {
 * 	parser.parse('{"a":\n')
 * } catch (error) {
 * 	if (isNDJSONError(error)) error.code // 'SYNTAX'
 * }
 * ```
 */
export class NDJSONError extends Error {
	readonly code: NDJSONErrorCode

	/**
	 * Creates an NDJSON error carrying a machine-readable code.
	 *
	 * @param code - The machine-readable code a `catch` branches on
	 * @param message - The human-readable description, carried as the `Error` message
	 */
	constructor(code: NDJSONErrorCode, message: string) {
		super(message)
		INTRINSICS.define(this, Symbol.for('@orkestrel/ndjson.NDJSONError'), { value: this })
		this.name = 'NDJSONError'
		this.code = code
	}
}

/**
 * Narrows an unknown caught value to an `NDJSONError`.
 *
 * @remarks
 * Recognizes the own identity brand and the declared code across package copies. Accepts
 * a subclass without requiring its name; refuses a transparent proxy, a look-alike error
 * without the brand, and a value carrying an unknown code. Never throws.
 *
 * @param value - The value to test (typically a `catch` binding)
 * @returns True if `value` is an `NDJSONError`; false otherwise
 *
 * @example
 * ```ts
 * import { createNDJSONParser, isNDJSONError } from '@orkestrel/ndjson'
 *
 * const parser = createNDJSONParser({ strict: true })
 * try {
 * 	parser.parse('[1,2]\n')
 * } catch (error) {
 * 	if (isNDJSONError(error)) error.code // 'RECORD'
 * }
 * ```
 */
export function isNDJSONError(value: unknown): value is NDJSONError {
	return holds(() => {
		if (!isInstance(value, Error) || INTRINSICS.prototype(value) === Error.prototype) return false
		if (INTRINSICS.describe(value, Symbol.for('@orkestrel/ndjson.NDJSONError'))?.value !== value)
			return false
		const code: unknown = INTRINSICS.reflect.read(value, 'code')
		return code === 'SYNTAX' || code === 'RECORD'
	})
}
