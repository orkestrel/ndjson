// The shared test infrastructure's own proof. `tests/setup.ts` exports the wire
// constants and the corpus-partitioning helpers that the `src:core` suites feed the
// parser through, so each one is proved here rather than trusted. It covers the
// workspace's fixtures rather than one module, which is why it sits at the tests root
// in its own `setup` project.
//
// Every expectation arrives by a route `tests/setup.ts` cannot share: the wire
// constants through the compiler's escape table and the platform's JSON grammar, the
// chunking families through hand-written enumerations, and `feedAll` through a manual
// feed loop written here. This package is core-only, so `tests/setup.ts` is
// host-independent and the whole module is reachable from the Node `setup` project.

import { NDJSONParser } from '@src/core'
import { attempt, isInstance, seededRandom } from '@orkestrel/contract'
import { captureError } from '@orkestrel/test'
import { describe, expect, it } from 'vitest'
import {
	BACKSLASH,
	CLEAN_CORPUS,
	CLEAN_RECORDS,
	chunkings,
	CR,
	feedAll,
	FF,
	LF,
	MALFORMED_LINES,
	MIXED_CORPUS,
	MIXED_RECORDS,
	NON_RECORD_LINES,
	partition,
	tabulation,
	TRIMMED_SPACES,
	VT,
} from './setup.js'

// A short Ollama-shaped corpus: two well-formed records around one malformed line, so
// a chunking that loses, duplicates, or reorders a chunk changes the decoded result.
const CORPUS =
	'{"content":"The"}' + LF + 'not valid json at all' + LF + '{"content":" quick","done":true}' + LF

// The same corpus cut by hand, with one record split across a chunk boundary and one
// chunk carrying the tail of one line and the head of the next.
const CHUNKS: readonly string[] = [
	'{"content":"Th',
	'e"}' + LF + 'not valid',
	' json at all' + LF + '{"content":" quick","done":true}' + LF,
]

describe('wire constants', () => {
	it('spells each constant as the single character its name denotes', () => {
		// Second route: the compiler's escape table rather than `String.fromCharCode`.
		expect([LF, CR, tabulation, FF, VT, BACKSLASH]).toEqual(['\n', '\r', '\t', '\f', '\v', '\\'])
	})

	it('keeps every constant distinct and one character wide, so a corpus can mix them', () => {
		const constants = [LF, CR, tabulation, FF, VT, BACKSLASH]

		expect(new Set(constants).size).toBe(constants.length)
		expect(constants.filter((constant) => constant.length !== 1)).toEqual([])
	})

	it('composes BACKSLASH with a letter into the JSON escape a consumer embeds in a line', () => {
		// The `src:core` suites build wire lines like `{"content":"a\nb\tc"}` from
		// BACKSLASH plus a letter. Second route: the platform's JSON grammar decodes it.
		const decoded: unknown = JSON.parse('{"content":"a' + BACKSLASH + 'nb' + BACKSLASH + 'tc"}')

		expect(decoded).toEqual({ content: 'a' + LF + 'b' + tabulation + 'c' })
	})
})

describe('feedAll', () => {
	it('threads every chunk through one parser, so a record split across chunks survives', () => {
		expect(feedAll(new NDJSONParser(), ['{"a":', '1}' + LF])).toEqual([{ a: 1 }])
	})

	it('flattens the records of every chunk into one array in feed order', () => {
		const chunks = ['{"a":1}' + LF + '{"b":2}' + LF, '{"c":3}' + LF]

		expect(feedAll(new NDJSONParser(), chunks)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
	})

	it('returns what a manual feed loop over the same chunks collects', () => {
		// Second route: the loop a consuming suite writes by hand. It disagrees the
		// moment `feedAll` reorders chunks, drops one, or feeds a fresh parser per chunk.
		const parser = new NDJSONParser()
		const records: Array<Record<string, unknown>> = []
		for (const chunk of CHUNKS) records.push(...parser.parse(chunk))

		expect(feedAll(new NDJSONParser(), CHUNKS)).toEqual(records)
	})

	it('returns no records when no chunk completes a line', () => {
		expect(feedAll(new NDJSONParser(), [])).toEqual([])
		expect(feedAll(new NDJSONParser(), ['', ''])).toEqual([])
	})
})

describe('chunkings', () => {
	it('enumerates one family per default size, then every two-way cut', () => {
		// Hand-written enumeration for a two-character stream: the sizes
		// {1,2,3,5,7,13,len} collapse to the whole stream past its length, and the cut
		// family runs from 0 to len inclusive.
		expect(chunkings('ab')).toEqual([
			['a', 'b'],
			['ab'],
			['ab'],
			['ab'],
			['ab'],
			['ab'],
			['ab'],
			['', 'ab'],
			['a', 'b'],
			['ab', ''],
		])
	})

	it('cuts a caller-supplied size list at exactly that width', () => {
		expect(chunkings('abcde', [2, 3]).slice(0, 2)).toEqual([
			['ab', 'cd', 'e'],
			['abc', 'de'],
		])
	})

	it('rejoins every chunking of a real corpus to the original stream, in order', () => {
		for (const chunks of chunkings(CORPUS)) expect(chunks.join('')).toBe(CORPUS)
	})

	it('yields one empty chunk per family for an empty stream, so a consumer always feeds', () => {
		expect(chunkings('')).toEqual([[''], [''], [''], [''], [''], [''], [''], ['', '']])
	})
})

describe('partition', () => {
	it('splits a corpus into non-empty chunks that rejoin to it, on every seeded draw', () => {
		const rng = seededRandom(0xc0ffee)

		Array.from({ length: 25 }, () => {
			const chunks = partition(CORPUS, rng)

			expect(chunks.join('')).toBe(CORPUS)
			expect(chunks.filter((chunk) => chunk.length === 0)).toEqual([])
		})
	})

	it('advances one character per draw at the bottom of the range, so it terminates', () => {
		expect(partition('abc', () => 0)).toEqual(['a', 'b', 'c'])
	})

	it('takes the whole remainder in one chunk at the top of the range', () => {
		expect(partition('abcde', () => 0.999)).toEqual(['abcde'])
	})

	it('repeats a partition exactly for a repeated seed, so a fuzz failure replays', () => {
		expect(partition(CORPUS, seededRandom(7))).toEqual(partition(CORPUS, seededRandom(7)))
	})

	it('returns no chunks for an empty stream', () => {
		expect(partition('', () => 0)).toEqual([])
	})
})

// Each expectation comes from the platform's JSON grammar or its regular-expression
// whitespace class, never from the parser these fixtures feed.
describe('strict-mode fixtures', () => {
	it('makes JSON.parse refuse each malformed line', () => {
		const accepted = MALFORMED_LINES.filter(([, line]) => {
			const error = captureError(() => JSON.parse(line))
			return !isInstance(error, SyntaxError)
		}).map(([title]) => title)

		expect(accepted).toEqual([])
		expect(MALFORMED_LINES.filter(([, line]) => line.includes(LF) || line.includes(CR))).toEqual([])
		expect(new Set(MALFORMED_LINES.map(([title]) => title)).size).toBe(MALFORMED_LINES.length)
	})

	it('parses each non-record line to a non-object', () => {
		const objects = NON_RECORD_LINES.filter(([, line]) => {
			const value: unknown = JSON.parse(line)
			return value !== null && !Array.isArray(value) && typeof value === 'object'
		}).map(([title]) => title)

		expect(objects).toEqual([])
		expect(new Set(NON_RECORD_LINES.map(([title]) => title)).size).toBe(NON_RECORD_LINES.length)
	})

	it('lists each code point trim strips but LF', () => {
		const spaces = TRIMMED_SPACES.map(([, space]) => space)
		const expected = Array.from({ length: 0x10000 }, (_, point) =>
			String.fromCodePoint(point),
		).filter((character) => character !== LF && /^\s$/u.test(character))

		expect(new Set(TRIMMED_SPACES.map(([title]) => title)).size).toBe(TRIMMED_SPACES.length)
		expect(spaces.filter((space) => Array.from(space).length !== 1 || space.trim() !== '')).toEqual(
			[],
		)
		expect(spaces.toSorted()).toEqual(expected)
	})

	it('lets JSON.parse admit only TAB, CR, and SP', () => {
		const admitted = TRIMMED_SPACES.filter(([, space]) => {
			const error = captureError(() => JSON.parse('{"a":1}' + space))
			return !isInstance(error, SyntaxError)
		}).map(([, space]) => space)

		expect(admitted).toEqual([tabulation, CR, ' '])
	})

	it('decodes CLEAN_CORPUS to CLEAN_RECORDS', () => {
		const records = CLEAN_CORPUS.split(/\r?\n/u)
			.filter((line) => line.trim() !== '')
			.map((line): unknown => JSON.parse(line))

		expect(records).toEqual(CLEAN_RECORDS)
	})

	it('keeps the plain objects of MIXED_CORPUS', () => {
		const objects = MIXED_CORPUS.split(LF).flatMap((line) => {
			const result = attempt((): unknown => JSON.parse(line))
			return result.success &&
				result.value !== null &&
				typeof result.value === 'object' &&
				Object.getPrototypeOf(result.value) === Object.prototype
				? [result.value]
				: []
		})

		expect(objects).toEqual(MIXED_RECORDS)
	})
})
