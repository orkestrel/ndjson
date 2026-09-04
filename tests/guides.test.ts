// The guides-parity gate: @orkestrel/guide's checks run against this repository's own
// `guides/README.md` manifest, and every flagship fence in `guides/ndjson.md` is transcribed here
// and asserted against what its comments claim. Name resolution is not a behavioural proof, so a
// fence documenting a value the code contradicts is exactly what the transcriptions catch. Change
// a fence, change its transcription.

import type { NDJSONParserInterface } from '@src/core'
import { describe, expect, it } from 'vitest'
import {
	computeSymbolKey,
	createGuide,
	createSource,
	createSourceManager,
	extractFenceImports,
	findMissing,
	findMissingSymbols,
	findUnexampled,
	findUnlisted,
	isExternalLink,
	parseManifest,
	resolveLink,
} from '@orkestrel/guide'
import { readFileSync } from 'node:fs'
import { requireValue } from '@orkestrel/test'
import { readInventory } from '@orkestrel/test/server'
import { NDJSONParser, createNDJSONParser } from '@src/core'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ '@orkestrel/ndjson': 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten — and the second assertion below fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

/** Root-level files this package's guides link to. `readInventory` walks directories only. */
const ROOT_FILES = Object.freeze(['AGENTS.md'])

const root = new URL('../', import.meta.url)
const files: Record<string, string> = {
	...readInventory(root, ['src', 'guides', 'tests'], { extensions: ['.ts', '.md'] }),
}
for (const name of ROOT_FILES) files[name] = readFileSync(new URL(name, root), 'utf8')
const manifest = parseManifest(
	requireValue(files['guides/README.md'], 'Missing file: guides/README.md'),
	'guides',
)
const sources = createSourceManager({ files, modules: MODULES })

it('manifest lists at least one guide', () => {
	expect(manifest.length).toBeGreaterThan(0)
})

for (const entry of manifest) {
	const guide = createGuide(requireValue(files[entry.spec], `Missing file: ${entry.spec}`))
	const source = createSource({ files, module: entry.source })

	describe(`${entry.concept}`, () => {
		it('uses only listed fence languages', () => {
			expect(findUnlisted(guide.fences(), FENCE_LANGUAGES)).toEqual([])
		})

		it('extracts a non-empty documented surface', () => {
			expect(guide.surface().length).toBeGreaterThan(0)
		})
		it('re-exports every direct declaration that is not named internal', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
		})
		it('names no symbol internal that the barrel already exports', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
		})
		it('re-exports only direct declarations', () => {
			expect(findMissingSymbols(source.surface(), source.exports())).toEqual([])
		})
		it('documents every barrel export', () => {
			expect(findMissingSymbols(source.surface(), guide.surface())).toEqual([])
		})
		it('documents only barrel exports', () => {
			expect(findMissingSymbols(guide.surface(), source.surface())).toEqual([])
		})

		it('exposes no hidden module-scope declarations', () => {
			expect(source.hidden().map(computeSymbolKey)).toEqual([])
		})

		for (const group of guide.methods()) {
			const members = source.methods(group.interface)
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface}`, () => {
				it('documents at least one method', () => {
					expect(group.methods.length).toBeGreaterThan(0)
				})
				it('documents every interface method', () => {
					expect(findMissing(members, group.methods)).toEqual([])
				})
				it('documents no phantom method', () => {
					expect(findMissing(group.methods, members)).toEqual([])
				})
				it(`${entity} exposes no undocumented method`, () => {
					const extra =
						entity === group.interface ? [] : findMissing(source.methods(entity), group.methods)
					expect(extra).toEqual([])
				})
			})
		}

		it('documents an example for every Surface function', () => {
			const fences = guide
				.fences()
				.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
				.map((fence) => fence.code)
			const names = guide
				.surface()
				.filter((symbol) => symbol.keyword === 'function')
				.map((symbol) => symbol.name)
			expect(findUnexampled(names, fences, source.examples())).toEqual([])
		})

		for (const group of guide.methods()) {
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface} examples`, () => {
				it('documents an example for every method', () => {
					const fences = guide
						.fences()
						.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
						.map((fence) => fence.code)
					const examples =
						entity === group.interface
							? source.examples(group.interface)
							: source.examples(group.interface).concat(source.examples(entity))
					expect(findUnexampled(group.methods, fences, examples)).toEqual([])
				})
			})
		}

		it('imports only real exports in every ```ts fence', () => {
			const fences = guide.fences().filter((fence) => fence.language === EXAMPLE_LANGUAGE)
			for (const fence of fences) {
				for (const { specifier, names } of extractFenceImports(fence.code)) {
					const imported = sources.source(specifier)
					if (imported === undefined) continue
					const surface = imported.surface().map((symbol) => symbol.name)
					expect(findMissing(names, surface)).toEqual([])
				}
			}
		})

		it('resolves every relative link', () => {
			const broken = guide
				.links()
				.filter((href) => !isExternalLink(href))
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(broken).toEqual([])
		})
		it('links only to test files that exist', () => {
			const missing = guide
				.tests()
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(missing).toEqual([])
		})
	})
}

/**
 * The Types fence of `guides/ndjson.md`, transcribed so its case can call it. The fence spells
 * the return type `readonly Record<string, unknown>[]`, which `typescript(array-type)` forbids in
 * source for a non-simple element type; `ReadonlyArray<Record<string, unknown>>` is the same type,
 * and the presence guard beside the case still binds the fence's own spelling.
 */
function feed(
	parser: NDJSONParserInterface,
	chunk: string,
): ReadonlyArray<Record<string, unknown>> {
	return parser.parse(chunk)
}

// The EXECUTED half of this file. Every check up to here reads a name — from the guide text
// or from the barrel — and a name that resolves proves nothing about the sentence beside it,
// so a fence whose comment claims a value the code contradicts passes all of them. The cases
// here run each flagship fence and assert the values its comments claim, each paired with a
// presence guard binding that fence's whole body, so a line one fence shares with another
// cannot stand in for it. Change a fence, change the transcription beside it.
describe('flagship fences', () => {
	const guideText = requireValue(files['guides/ndjson.md'], 'Missing file: guides/ndjson.md')
	const readmeText = readFileSync(new URL('README.md', root), 'utf8')

	it('returns the Surface fence values and clears back to a fresh stream', () => {
		const parser = createNDJSONParser()

		expect(parser.parse('{"a":1}\n{"b"')).toEqual([{ a: 1 }])
		expect(parser.parse(':2}\n')).toEqual([{ b: 2 }])
		parser.clear()

		expect(parser.parse('{"z":9}\n')).toEqual([{ z: 9 }])
	})

	it('carries the Surface fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'const parser = createNDJSONParser()\nparser.parse(\'{"a":1}\\n{"b"\') // [{ a: 1 }] - the second line is still partial\nparser.parse(\':2}\\n\') // [{ b: 2 }] - the split line reassembled\nparser.clear() // drop any buffered partial - ready for a fresh stream',
		)
	})

	it('returns the Types fence value through the documented signature', () => {
		expect(feed(createNDJSONParser(), '{"a":1}\n')).toEqual([{ a: 1 }])
	})

	it('carries the Types fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'function feed(parser: NDJSONParserInterface, chunk: string): readonly Record<string, unknown>[] {\n\treturn parser.parse(chunk)\n}',
		)
	})

	it('returns the Factories fence values from one chunk carrying two lines', () => {
		expect(createNDJSONParser().parse('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('carries the Factories fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'const parser = createNDJSONParser()\nparser.parse(\'{"a":1}\\n{"b":2}\\n\') // [{ a: 1 }, { b: 2 }]',
		)
	})

	it('returns the Methods fence values from a directly constructed parser', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\n{"b"')).toEqual([{ a: 1 }])
		expect(parser.parse(':2}\n')).toEqual([{ b: 2 }])
		parser.clear()

		expect(parser.parse('{"c":3}\n')).toEqual([{ c: 3 }])
	})

	it('carries the Methods fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'const parser = new NDJSONParser()\nparser.parse(\'{"a":1}\\n{"b"\') // [{ a: 1 }] - the second line is still partial\nparser.parse(\':2}\\n\') // [{ b: 2 }] - the split line reassembled\nparser.clear() // drop any buffered partial - ready for a fresh stream\nparser.parse(\'{"c":3}\\n\') // [{ c: 3 }]',
		)
	})

	it('returns the README usage fence values, skipping the malformed and blank lines', () => {
		const parser = createNDJSONParser()

		expect(parser.parse('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }])
		expect(parser.parse('{"c":3}')).toEqual([])
		expect(parser.parse('\n')).toEqual([{ c: 3 }])
		expect(parser.parse('not json\n\n{"d":4}\n')).toEqual([{ d: 4 }])
	})

	it('carries the README usage fence lines the transcription copies', () => {
		expect(readmeText).toContain(
			'const parser = createNDJSONParser()\nparser.parse(\'{"a":1}\\n{"b":2}\\n\') // [{ a: 1 }, { b: 2 }]\nparser.parse(\'{"c":3}\') // [] - buffered until its trailing newline arrives\nparser.parse(\'\\n\') // [{ c: 3 }]\n\nparser.parse(\'not json\\n\\n{"d":4}\\n\') // [{ d: 4 }] - malformed and blank lines skipped\n\nparser.clear() // drop buffered partial line - reuse for a fresh stream',
		)
	})
})
