import { NDJSONParser, createNDJSONParser } from '@src/core'
import { describe, expect, it } from 'vitest'
import { feedAll } from '../../setup.js'

// The parser factory — createNDJSONParser returns a working NDJSONParserInterface.
// Full buffering / malformed / cross-chunk behavior lives in NDJSONParser.test.ts;
// here we assert the factory hands back a usable, independent handle.

describe('createNDJSONParser', () => {
	it('returns a working NDJSONParserInterface (parses a complete line)', () => {
		const parser = createNDJSONParser()

		expect(parser.parse('{"a":1}\n')).toEqual([{ a: 1 }])
	})

	it('buffers a line split across calls until its newline arrives', () => {
		const parser = createNDJSONParser()

		expect(parser.parse('{"a":1,"b')).toEqual([])
		expect(parser.parse('":2}\n')).toEqual([{ a: 1, b: 2 }])
	})

	it('clears buffered state on reset', () => {
		const parser = createNDJSONParser()

		expect(parser.parse('{"a":1,"b')).toEqual([])
		parser.reset()

		expect(parser.parse('":2}\n{"fresh":true}\n')).toEqual([{ fresh: true }])
	})

	it('hands back independent handles that do not share buffer state', () => {
		const first = createNDJSONParser()
		const second = createNDJSONParser()

		// A partial buffered in `first` must not leak into `second`.
		expect(first.parse('{"a":1')).toEqual([])
		expect(second.parse('{"c":3}\n')).toEqual([{ c: 3 }])
		expect(first.parse('}\n')).toEqual([{ a: 1 }])
	})

	it('two createNDJSONParser() instances are fully independent (state isolation)', () => {
		const first = createNDJSONParser()
		const second = createNDJSONParser()

		expect(first.parse('{"buffered":true')).toEqual([])
		expect(second.parse('{"independent":true}\n')).toEqual([{ independent: true }])
		// The first instance's buffered fragment is untouched by the second's activity.
		expect(first.parse('}\n')).toEqual([{ buffered: true }])
	})

	it('a factory-built parser behaves identically to `new NDJSONParser()` over a shared corpus', () => {
		const corpus =
			'{"message":{"content":"The"},"done":false}\n' +
			'{"message":{"content":" quick"},"done":false}\n' +
			'{"message":{"content":""},"done":true,"eval_count":2}\n'

		const fromFactory = feedAll(createNDJSONParser(), [corpus])
		const fromClass = feedAll(new NDJSONParser(), [corpus])

		expect(fromFactory).toEqual(fromClass)
	})
})
