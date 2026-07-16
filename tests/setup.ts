// Base test setup — environment-agnostic helpers loaded first by every
// Vitest project (`setupFiles[0]`). Keep this file free of `node:*` and of
// `document` / `window`: this package is core-only.
//
// Scoped to the `ndjson` corpus this workspace ships today (AGENTS §16.1): NDJSON
// line-terminator constants and corpus-partitioning helpers for chunk-boundary
// invariance testing. Seeded-fuzz partitioning uses @orkestrel/contract's
// `seededRandom` directly — no local PRNG.

import type { NDJSONParserInterface } from '@src/core'
import { afterEach, vi } from 'vitest'

afterEach(() => {
	vi.restoreAllMocks()
})

// ── NDJSON line-terminator / whitespace constants (shared — AGENTS §16.1) ──

// Control bytes spelled as codepoints so the raw wire content is unambiguous
// in source (a literal `'\r'` is identical, but the codepoint removes doubt).
export const LF = String.fromCharCode(10)
export const CR = String.fromCharCode(13)
export const TAB = String.fromCharCode(9)
export const FF = String.fromCharCode(12)
export const VT = String.fromCharCode(11)
export const BACKSLASH = String.fromCharCode(92)

// ── NDJSONParser corpus-partitioning helpers (generic, environment-agnostic) ─

/**
 * Feed every chunk in `chunks` to `parser.parse(...)` in order and flatten the
 * decoded records into a single array.
 */
export function feedAll(
	parser: NDJSONParserInterface,
	chunks: readonly string[],
): readonly Record<string, unknown>[] {
	const records: Record<string, unknown>[] = []
	for (const chunk of chunks) records.push(...parser.parse(chunk))
	return records
}

/**
 * Partition `stream` into a fixed set of chunkings for partition-invariance
 * testing: one chunking per fixed size in `sizes` (default `{1,2,3,5,7,13,len}`)
 * plus every two-way single-cut split (`stream.slice(0, cut)` /
 * `stream.slice(cut)` for every `cut` from `0` to `stream.length`).
 */
export function chunkings(
	stream: string,
	sizes: readonly number[] = [1, 2, 3, 5, 7, 13, stream.length],
): readonly (readonly string[])[] {
	const result: string[][] = []
	for (const size of sizes) {
		const chunks: string[] = []
		for (let index = 0; index < stream.length; index += size) {
			chunks.push(stream.slice(index, index + size))
		}
		if (chunks.length === 0) chunks.push('')
		result.push(chunks)
	}
	for (let cut = 0; cut <= stream.length; cut += 1) {
		result.push([stream.slice(0, cut), stream.slice(cut)])
	}
	return result
}

/**
 * Split `stream` into a random sequence of non-empty chunks driven by `rng`
 * (e.g. `seededRandom` from `@orkestrel/contract`) — every call consumes at
 * least one character, so it always terminates.
 */
export function partition(stream: string, rng: () => number): readonly string[] {
	const chunks: string[] = []
	let index = 0
	while (index < stream.length) {
		const remaining = stream.length - index
		const size = Math.max(1, Math.floor(rng() * remaining) + 1)
		chunks.push(stream.slice(index, index + size))
		index += size
	}
	return chunks
}
