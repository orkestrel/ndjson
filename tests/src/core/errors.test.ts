import { NDJSONError, isNDJSONError } from '@src/core'
import { describe, expect, it } from 'vitest'

describe('isNDJSONError', () => {
	it('accepts an NDJSONError and a subclass', () => {
		class DerivedError extends NDJSONError {}

		const derived = new DerivedError('RECORD', 'derived')
		derived.name = 'DerivedError'
		const errors = [
			new NDJSONError('SYNTAX', 'syntax'),
			new NDJSONError('RECORD', 'record'),
			derived,
		]

		expect(errors.map((error) => isNDJSONError(error))).toEqual([true, true, true])
	})

	it('refuses a look-alike, proxy, or brand', () => {
		class LookalikeError extends Error {
			readonly code = 'SYNTAX' as const
		}

		const plain = {}
		Object.defineProperty(plain, Symbol.for('@orkestrel/ndjson.NDJSONError'), { value: plain })
		const values = [
			new LookalikeError('look-alike'),
			new Proxy(new NDJSONError('SYNTAX', 'proxied'), {}),
			plain,
			undefined,
			null,
		]

		expect(values.map((value) => isNDJSONError(value))).toEqual([false, false, false, false, false])
	})

	it('refuses an unknown code', () => {
		const error = new NDJSONError('SYNTAX', 'foreign')
		Object.defineProperty(error, 'code', { value: 'FOREIGN' })

		expect(isNDJSONError(error)).toBe(false)
	})

	it('stamps a hidden, fixed brand', () => {
		const error = new NDJSONError('RECORD', 'branded')
		const descriptor = Object.getOwnPropertyDescriptor(
			error,
			Symbol.for('@orkestrel/ndjson.NDJSONError'),
		)

		expect(descriptor?.value).toBe(error)
		expect(descriptor?.enumerable).toBe(false)
		expect(descriptor?.writable).toBe(false)
	})
})
