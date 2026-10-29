// Base test setup — environment-agnostic helpers loaded first by every
// Vitest project (`setupFiles[0]`). Keep this file free of `node:*` and of
// `document` / `window`: this package is core-only.
//
// Scoped to the `ndjson` corpus this workspace ships today: NDJSON
// line-terminator constants and corpus-partitioning helpers for chunk-boundary
// invariance testing. Seeded-fuzz partitioning uses @orkestrel/contract's
// `seededRandom` directly — no local PRNG.

import type { NDJSONParserInterface } from '@src/core'
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
