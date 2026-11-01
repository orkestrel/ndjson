// Base test setup — environment-agnostic helpers loaded first by every
// Vitest project (`setupFiles[0]`). Keep this file free of `node:*` and of
// `document` / `window`: this package is core-only.
//
// Scoped to the `ndjson` corpus this workspace ships today: NDJSON
// line-terminator constants and corpus-partitioning helpers for chunk-boundary
// invariance testing. Seeded-fuzz partitioning uses @orkestrel/contract's
// `seededRandom` directly — no local PRNG.

import type { NDJSONParserInterface } from '@src/core'
import { NDJSONParser } from '@src/core'
import { afterEach, vi } from 'vitest'

afterEach(() => {
	vi.restoreAllMocks()
})

// ── NDJSON line-terminator / whitespace constants (shared) ──

// Control bytes spelled as codepoints so the raw wire content is unambiguous
// in source (a literal `'\r'` is identical, but the codepoint removes doubt).
export const LF = String.fromCharCode(10)
export const CR = String.fromCharCode(13)
export const tabulation = String.fromCharCode(9)
export const FF = String.fromCharCode(12)
export const VT = String.fromCharCode(11)
export const BACKSLASH = String.fromCharCode(92)

/** Parses a stream through fixed-size chunks and collects its records. */
export function drainStream(stream: string, size: number): ReadonlyArray<Record<string, unknown>> {
	const parser = new NDJSONParser()
	return Array.from({ length: Math.ceil(stream.length / size) }, (_, index) =>
		parser.parse(stream.slice(index * size, (index + 1) * size)),
	).flat()
}

/** Parses numbered records one character at a time and collects them. */
export function drainByByte(count: number): ReadonlyArray<Record<string, unknown>> {
	const parser = new NDJSONParser()
	const stream = Array.from({ length: count }, (_, index) => JSON.stringify({ index }) + LF).join(
		'',
	)
	return Array.from(stream, (character) => parser.parse(character)).flat()
}

// ── NDJSONParser corpus-partitioning helpers (generic, environment-agnostic) ─

/**
 * Feeds every chunk in `chunks` to `parser.parse(...)` in order and flattens
 * the decoded records into a single array.
 */
export function feedAll(
	parser: NDJSONParserInterface,
	chunks: readonly string[],
): ReadonlyArray<Record<string, unknown>> {
	return Iterator.from(chunks)
		.flatMap((chunk) => parser.parse(chunk))
		.toArray()
}

/**
 * Splits `stream` into a fixed set of chunk sequences for chunking-invariance
 * testing: one sequence per fixed size in `sizes` (default
 * `{1,2,3,5,7,13,len}`) plus every two-way single-cut split
 * (`stream.slice(0, cut)` / `stream.slice(cut)` for every `cut` from `0` to
 * `stream.length`).
 */
export function chunkings(
	stream: string,
	sizes: readonly number[] = [1, 2, 3, 5, 7, 13, stream.length],
): ReadonlyArray<readonly string[]> {
	return [
		...Iterator.from(sizes).map((size) =>
			Array.from({ length: Math.max(1, Math.ceil(stream.length / size) || 0) }, (_, index) =>
				stream.slice(index * size, (index + 1) * size),
			),
		),
		...Array.from({ length: stream.length + 1 }, (_, cut) => [
			stream.slice(0, cut),
			stream.slice(cut),
		]),
	]
}

/**
 * Splits `stream` into a random sequence of non-empty chunks driven by `rng`
 * (for example the `seededRandom` function from `@orkestrel/contract`) — every
 * call consumes at least one character, so it always terminates.
 */
export function partition(stream: string, rng: () => number): readonly string[] {
	if (stream.length === 0) return []
	const size = Math.max(1, Math.floor(rng() * stream.length) + 1)
	return [stream.slice(0, size), ...partition(stream.slice(size), rng)]
}

// ── Strict-mode fixtures: refused lines, trimmed spaces, and hand-decoded corpora ──

/** Lists titled complete lines, each without a line terminator, that are not valid JSON. */
export const MALFORMED_LINES: ReadonlyArray<readonly [string, string]> = Object.freeze([
	['prose', 'not json at all'],
	['truncated object', '{"oops":'],
	['trailing comma', '{"a":1,}'],
	['single quotes', "{'a':1}"],
	['unquoted key', '{a:1}'],
	['two values on one line', '{"a":1} {"b":2}'],
	['bare word', 'NaN'],
])

/** Lists titled complete lines that are valid JSON but not a plain record. */
export const NON_RECORD_LINES: ReadonlyArray<readonly [string, string]> = Object.freeze([
	['empty array', '[]'],
	['array', '[1,2]'],
	['null', 'null'],
	['integer', '42'],
	['negative zero', '-0'],
	['exponent', '1e3'],
	['string', '"s"'],
	['true', 'true'],
	['false', 'false'],
])

/**
 * Lists titled single code points that `String.prototype.trim` strips, every one but LF,
 * each written as an escape so no invisible or control character sits in the source.
 */
export const TRIMMED_SPACES: ReadonlyArray<readonly [string, string]> = Object.freeze([
	['character tabulation', '\u{9}'],
	['line tabulation', '\u{B}'],
	['form feed', '\u{C}'],
	['carriage return', '\u{D}'],
	['space', '\u{20}'],
	['no-break space', '\u{A0}'],
	['ogham space mark', '\u{1680}'],
	['en quad', '\u{2000}'],
	['em quad', '\u{2001}'],
	['en space', '\u{2002}'],
	['em space', '\u{2003}'],
	['three-per-em space', '\u{2004}'],
	['four-per-em space', '\u{2005}'],
	['six-per-em space', '\u{2006}'],
	['figure space', '\u{2007}'],
	['punctuation space', '\u{2008}'],
	['thin space', '\u{2009}'],
	['hair space', '\u{200A}'],
	['line separator', '\u{2028}'],
	['paragraph separator', '\u{2029}'],
	['narrow no-break space', '\u{202F}'],
	['medium mathematical space', '\u{205F}'],
	['ideographic space', '\u{3000}'],
	['zero width no-break space', '\u{FEFF}'],
])

/**
 * Holds a stream of object lines with an empty line, a line of spaces and a tab, a
 * CRLF-terminated record, a line holding only CR, and an escaped newline inside a string.
 */
export const CLEAN_CORPUS =
	'{"id":1,"text":"alpha"}' +
	LF +
	LF +
	'   ' +
	tabulation +
	LF +
	'{"id":2,"nested":{"list":[1,2,3]}}' +
	CR +
	LF +
	CR +
	LF +
	'{"id":3,"text":"line' +
	BACKSLASH +
	'nbreak"}' +
	LF +
	'{"id":4,"text":"omega"}' +
	LF

/** Lists the records of `CLEAN_CORPUS`, decoded by hand. */
export const CLEAN_RECORDS: ReadonlyArray<Record<string, unknown>> = Object.freeze([
	{ id: 1, text: 'alpha' },
	{ id: 2, nested: { list: [1, 2, 3] } },
	{ id: 3, text: 'line' + LF + 'break' },
	{ id: 4, text: 'omega' },
])

/** Holds object lines interleaved with malformed, non-record, blank, and CRLF lines. */
export const MIXED_CORPUS =
	'{"a":1}' +
	LF +
	'not json' +
	LF +
	'[1,2]' +
	LF +
	LF +
	'{"b":2}' +
	CR +
	LF +
	'null' +
	LF +
	'   ' +
	LF +
	'{"c":' +
	LF +
	'42' +
	CR +
	LF +
	'{"d":{"e":[true]}}' +
	LF +
	'"text"' +
	LF +
	"{'x':1}" +
	LF +
	'{"f":"g"}' +
	LF

/** Lists the object records of `MIXED_CORPUS`, decoded by hand. */
export const MIXED_RECORDS: ReadonlyArray<Record<string, unknown>> = Object.freeze([
	{ a: 1 },
	{ b: 2 },
	{ d: { e: [true] } },
	{ f: 'g' },
])
