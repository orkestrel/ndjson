import { NDJSONParser } from '@src/core'
import { describe, expect, it } from 'vitest'
import {
	BACKSLASH,
	CR,
	FF,
	LF,
	TAB,
	VT,
	chunkings,
	feedAll,
	mulberry32,
	partition,
} from '../../setup.js'

// The NDJSON stream parser — the load-bearing behavior is partial-line buffering:
// split the buffer on `\n`, emit every COMPLETE (`\n`-terminated) line parsed to a
// record, and retain the trailing partial line for the next call. Records only
// (malformed / non-object lines skipped, never throwing); a never-terminated line
// stays buffered forever. Driven entirely with plain strings — no network, no
// provider, no fakes (AGENTS §16).

describe('NDJSONParser — complete lines', () => {
	it('parses a single complete line to one record', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\n')).toEqual([{ a: 1 }])
	})

	it('parses multiple complete lines in one chunk, in order', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\n{"b":2}\n{"c":3}\n')).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
	})

	it('preserves nested structure and value types in a parsed record', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"n":1,"s":"x","b":true,"z":null,"o":{"k":[1,2]}}\n')).toEqual([
			{ n: 1, s: 'x', b: true, z: null, o: { k: [1, 2] } },
		])
	})
})

describe('NDJSONParser — partial-line buffering', () => {
	it('buffers a line split across two parse calls (the headline)', () => {
		const parser = new NDJSONParser()

		// The first chunk has no newline — the whole line is incomplete.
		expect(parser.parse('{"a":1,"b')).toEqual([])
		// The closing `\n` arrives — the reassembled line emits one record.
		expect(parser.parse('":2}\n')).toEqual([{ a: 1, b: 2 }])
	})

	it('emits the complete line and buffers a trailing partial in one chunk', () => {
		const parser = new NDJSONParser()

		// One complete line + a trailing partial — only the complete one emits.
		expect(parser.parse('{"x":1}\n{"y"')).toEqual([{ x: 1 }])
		// The buffer holds `{"y"`; it completes once the rest + a `\n` arrive.
		expect(parser.parse(':2}\n')).toEqual([{ y: 2 }])
	})

	it('reassembles a line split across three chunks', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"deep"')).toEqual([])
		expect(parser.parse(':{"nested":')).toEqual([])
		expect(parser.parse('true}}\n')).toEqual([{ deep: { nested: true } }])
	})

	it('keeps a final newline-less fragment buffered until a newline arrives', () => {
		const parser = new NDJSONParser()

		// A complete line emits; the trailing fragment (no `\n`) stays buffered.
		expect(parser.parse('{"done":false}\n{"done"')).toEqual([{ done: false }])
		// Still no terminating `\n` — nothing new emits, the fragment grows.
		expect(parser.parse(':tru')).toEqual([])
		// The `\n` finally arrives — the buffered fragment emits.
		expect(parser.parse('e}\n')).toEqual([{ done: true }])
	})
})

describe('NDJSONParser — Ollama-style stream at arbitrary chunk boundaries', () => {
	// A realistic Ollama /api/chat NDJSON stream: a run of content deltas, then a
	// terminal `done` frame. Reassembly must be independent of WHERE the bytes were
	// chunked — so we feed the exact same stream split three different ways and
	// assert the same records come back.
	const stream =
		'{"message":{"content":"The"},"done":false}\n' +
		'{"message":{"content":" quick"},"done":false}\n' +
		'{"message":{"content":" fox"},"done":false}\n' +
		'{"message":{"content":""},"done":true,"eval_count":2}\n'

	const expected = [
		{ message: { content: 'The' }, done: false },
		{ message: { content: ' quick' }, done: false },
		{ message: { content: ' fox' }, done: false },
		{ message: { content: '' }, done: true, eval_count: 2 },
	]

	// Feed `stream` to a fresh parser in fixed-size slices and collect every record.
	const drain = (size: number): readonly Record<string, unknown>[] => {
		const parser = new NDJSONParser()
		const records: Record<string, unknown>[] = []
		for (let index = 0; index < stream.length; index += size) {
			records.push(...parser.parse(stream.slice(index, index + size)))
		}
		return records
	}

	it('reassembles when fed as one whole chunk', () => {
		expect(drain(stream.length)).toEqual(expected)
	})

	it('reassembles when split mid-content / mid-key (3-char slices)', () => {
		expect(drain(3)).toEqual(expected)
	})

	it('reassembles when split one character at a time', () => {
		expect(drain(1)).toEqual(expected)
	})

	it('reassembles across every possible split point', () => {
		// Exhaustive: a two-chunk split at every index reassembles identically.
		for (let cut = 0; cut <= stream.length; cut += 1) {
			const parser = new NDJSONParser()
			const records = [...parser.parse(stream.slice(0, cut)), ...parser.parse(stream.slice(cut))]
			expect(records).toEqual(expected)
		}
	})

	it('streams the content deltas in order regardless of chunking', () => {
		const contents = drain(2).map((record) => {
			const message = record['message']
			return typeof message === 'object' && message !== null
				? Reflect.get(message, 'content')
				: undefined
		})

		expect(contents).toEqual(['The', ' quick', ' fox', ''])
	})
})

describe('NDJSONParser — malformed and non-object lines', () => {
	it('skips a malformed JSON line without throwing, later valid lines still parse', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\nnot json at all\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('drops a non-object line and keeps the records around it', () => {
		const parser = new NDJSONParser()

		// 42 / "str" / [1,2] / null / true are valid JSON but not records — dropped.
		expect(parser.parse('42\n"str"\n[1,2]\nnull\ntrue\n{"ok":true}\n')).toEqual([{ ok: true }])
	})

	it('drops every non-object value when no record is present', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('1\n2\n[]\nnull\n')).toEqual([])
	})

	it('never throws on a truncated-JSON fragment left in the buffer', () => {
		const parser = new NDJSONParser()

		// A `\n`-terminated truncated object IS a complete (malformed) line → skipped.
		expect(parser.parse('{"oops":\n{"ok":1}\n')).toEqual([{ ok: 1 }])
	})
})

describe('NDJSONParser — empty and whitespace lines', () => {
	it('skips empty lines between records', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\n\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('skips a run of consecutive newlines', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('\n\n\n{"a":1}\n\n\n')).toEqual([{ a: 1 }])
	})

	it('skips whitespace-only lines', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('   \n\t\n{"a":1}\n')).toEqual([{ a: 1 }])
	})

	it('returns nothing for a chunk with no newline (all buffered)', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}')).toEqual([])
		// Proof it was buffered, not lost: the terminator emits it.
		expect(parser.parse('\n')).toEqual([{ a: 1 }])
	})

	it('returns nothing for an empty chunk', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('')).toEqual([])
	})
})

describe('NDJSONParser — never-terminated line', () => {
	it('never emits a line that never receives a trailing newline', () => {
		const parser = new NDJSONParser()

		// Fed across several calls, but no `\n` ever — correctly never emitted.
		expect(parser.parse('{"a"')).toEqual([])
		expect(parser.parse(':1,')).toEqual([])
		expect(parser.parse('"b":2}')).toEqual([])
		// Even a syntactically-complete object is incomplete as a LINE without `\n`.
		expect(parser.parse('')).toEqual([])
	})
})

describe('NDJSONParser — reset', () => {
	it('discards a buffered partial line so a later parse starts fresh', () => {
		const parser = new NDJSONParser()

		// Buffer a partial line, then reset before it completes.
		expect(parser.parse('{"a":1,"b')).toEqual([])
		parser.reset()

		// The old fragment is gone — the previously-completing tail is now its own
		// (malformed) line and is dropped, while a fresh valid line parses normally.
		expect(parser.parse('":2}\n{"fresh":true}\n')).toEqual([{ fresh: true }])
	})

	it('is a safe no-op with an empty buffer', () => {
		const parser = new NDJSONParser()

		parser.reset()
		parser.reset()

		expect(parser.parse('{"a":1}\n')).toEqual([{ a: 1 }])
	})

	it('keeps parsing normally across many reset calls (interleaved with parse)', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}\n{"b"')).toEqual([{ a: 1 }])
		parser.reset() // drop the buffered `{"b"`
		expect(parser.parse('{"c":3}\n')).toEqual([{ c: 3 }])
		parser.reset()
		parser.reset() // back-to-back resets stay harmless
		expect(parser.parse('{"d":4}\n')).toEqual([{ d: 4 }])
	})
})

describe('NDJSONParser — CRLF and carriage-return handling', () => {
	// Windows-origin wires terminate lines with CRLF. The parser splits on `\n`
	// only, leaving a trailing `\r` on each line — which `trim()` then strips, so
	// the emitted record is clean. These pin that the `\r` never leaks into output.
	it('parses a single CRLF-terminated line to a clean record (no trailing \\r)', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}' + CR + LF)).toEqual([{ a: 1 }])
	})

	it('parses multiple CRLF-terminated lines, every record clean', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1}' + CR + LF + '{"b":2}' + CR + LF)).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('reassembles a CRLF split BETWEEN the \\r and the \\n across two chunks', () => {
		const parser = new NDJSONParser()

		// First chunk ends on the bare `\r` — no `\n` yet, so nothing is complete.
		expect(parser.parse('{"a":1}' + CR)).toEqual([])
		// The `\n` arrives in the next chunk; the line completes and emits clean.
		expect(parser.parse(LF)).toEqual([{ a: 1 }])
	})

	it('strips a trailing \\r even on a partial line reassembled across chunks', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a"')).toEqual([])
		expect(parser.parse(':1}' + CR + LF)).toEqual([{ a: 1 }])
	})

	it('preserves an ESCAPED \\r (two chars) inside a string value', () => {
		const parser = new NDJSONParser()

		// `"x\ry"` in the JSON source is a value whose middle char is a real CR after
		// JSON.parse — that escaped CR must survive, distinct from a line-ending CR.
		const out = parser.parse('{"a":"x' + BACKSLASH + 'ry"}' + LF)

		expect(out).toEqual([{ a: 'x' + CR + 'y' }])
	})

	it('does NOT split on a lone \\r — CR-only line endings buffer entirely (limitation)', () => {
		const parser = new NDJSONParser()

		// Old-Mac CR-only framing is NOT NDJSON: the parser splits on `\n` alone, so a
		// `\r`-separated stream is one never-terminated line and emits nothing.
		expect(parser.parse('{"a":1}' + CR + '{"b":2}' + CR)).toEqual([])
		// A real `\n` would be needed to flush; proving the buffer held it all.
		expect(parser.parse(LF)).toEqual([])
	})
})

describe('NDJSONParser — escaped vs. raw newlines inside string values', () => {
	// THE wire-realism case: Ollama content deltas carry newlines encoded as the
	// two-character escape `\n` (valid JSON). The parser splits the RAW text on the
	// `\n` byte BEFORE parsing, so an escaped `\n` (backslash + n, no real newline
	// byte) must pass through untouched and decode to a real newline in the value.
	it('preserves an escaped \\n (two chars) inside a value — splits only on real newlines', () => {
		const parser = new NDJSONParser()

		const out = parser.parse('{"content":"line1' + BACKSLASH + 'nline2"}' + LF)

		expect(out).toEqual([{ content: 'line1' + LF + 'line2' }])
	})

	it('reassembles an escaped \\n split across chunks AT the backslash', () => {
		const parser = new NDJSONParser()

		// Chunk boundary falls between the backslash and the `n` of the escape.
		expect(parser.parse('{"content":"x' + BACKSLASH)).toEqual([])
		expect(parser.parse('ny"}' + LF)).toEqual([{ content: 'x' + LF + 'y' }])
	})

	it('preserves an escaped \\t (two chars) inside a value', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"content":"a' + BACKSLASH + 'tb"}' + LF)).toEqual([
			{ content: 'a' + TAB + 'b' },
		])
	})

	it('preserves an escaped \\r\\n sequence inside a value (does not line-break on it)', () => {
		const parser = new NDJSONParser()

		const out = parser.parse('{"content":"a' + BACKSLASH + 'r' + BACKSLASH + 'nb"}' + LF)

		expect(out).toEqual([{ content: 'a' + CR + LF + 'b' }])
	})

	it('drops a line with a RAW literal newline inside a value, surrounding records survive (limitation)', () => {
		const parser = new NDJSONParser()

		// A raw `\n` byte inside a string is invalid JSON per spec AND splits the line
		// in two before parsing — so the record is dropped. NDJSON forbids this and
		// Ollama escapes such newlines; this documents the boundary. The valid records
		// on either side are unaffected.
		const out = parser.parse('{"ok":1}' + LF + '{"bad":"x' + LF + 'y"}' + LF + '{"ok":2}' + LF)

		expect(out).toEqual([{ ok: 1 }, { ok: 2 }])
	})
})

describe('NDJSONParser — whitespace-only line variety', () => {
	// `trim()` treats every ASCII whitespace byte as blank, so a line of tabs, form
	// feeds, vertical tabs, or a stray `\r` (a stripped CRLF blank line) is skipped.
	it('skips tab-only, form-feed-only, vertical-tab-only, and \\r-only lines between records', () => {
		const parser = new NDJSONParser()

		const out = parser.parse(
			'{"a":1}' + LF + TAB + LF + FF + LF + VT + LF + CR + LF + '{"b":2}' + LF,
		)

		expect(out).toEqual([{ a: 1 }, { b: 2 }])
	})

	it('skips a mixed run of spaces and tabs on a line', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('  ' + TAB + ' ' + LF + '{"a":1}' + LF)).toEqual([{ a: 1 }])
	})

	it('emits nothing for a chunk that is exactly a single newline', () => {
		const parser = new NDJSONParser()

		expect(parser.parse(LF)).toEqual([])
	})

	it('emits nothing across many empty and newline-only chunks, then flushes the buffered record', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('')).toEqual([])
		expect(parser.parse('{"a":1}')).toEqual([]) // buffered, no terminator yet
		expect(parser.parse('')).toEqual([])
		expect(parser.parse('')).toEqual([])
		expect(parser.parse(LF)).toEqual([{ a: 1 }]) // terminator finally flushes it
	})
})

describe('NDJSONParser — value shapes and JSON semantics', () => {
	it('parses an empty object line to an empty record', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{}' + LF)).toEqual([{}])
	})

	it('drops an empty-array line (a non-object value)', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('[]' + LF + '{"ok":1}' + LF)).toEqual([{ ok: 1 }])
	})

	it('applies JSON last-wins semantics for duplicate keys on a line', () => {
		const parser = new NDJSONParser()

		expect(parser.parse('{"a":1,"a":2}' + LF)).toEqual([{ a: 2 }])
	})

	it('drops a number with a trailing-newline that looks complete but is not an object', () => {
		const parser = new NDJSONParser()

		// `0`, `-0`, and `1e3` are valid JSON numbers but not records — all dropped.
		expect(parser.parse('0' + LF + '-0' + LF + '1e3' + LF + '{"keep":true}' + LF)).toEqual([
			{ keep: true },
		])
	})

	it('keeps a JSON record carrying a literal __proto__ KEY without polluting the prototype', () => {
		const parser = new NDJSONParser()

		// JSON.parse turns `"__proto__"` into an own data property (not a setter), so
		// the value is a normal record and the global Object prototype is untouched.
		const out = parser.parse('{"__proto__":{"polluted":true},"a":1}' + LF)

		// Mapping (rather than indexing) keeps the element non-optional, so the key /
		// value assertions need no `if` guard. The `__proto__` survives as a real key.
		expect(out.map((record) => Object.keys(record))).toEqual([['__proto__', 'a']])
		expect(out.map((record) => record['a'])).toEqual([1])
		// The smoking gun: no plain object anywhere gained a `polluted` property.
		expect(Reflect.get({}, 'polluted')).toBeUndefined()
	})

	it('parses multibyte unicode (emoji, CJK, combining marks) inside a complete line', () => {
		const parser = new NDJSONParser()

		const out = parser.parse('{"emoji":"\u{1F600}","cjk":"你好","combo":"é"}' + LF)

		expect(out).toEqual([{ emoji: '\u{1F600}', cjk: '你好', combo: 'é' }])
	})

	it('parses a large, deeply-nested record buffered across many small chunks', () => {
		const parser = new NDJSONParser()

		const big = {
			level: 0,
			items: Array.from({ length: 100 }, (_, index) => ({ index, value: 'item-' + String(index) })),
			child: { child: { child: { leaf: 'deep' } } },
		}
		const text = JSON.stringify(big) + LF

		const records: Record<string, unknown>[] = []
		for (let index = 0; index < text.length; index += 7) {
			records.push(...parser.parse(text.slice(index, index + 7)))
		}

		expect(records).toEqual([big])
	})
})

describe('NDJSONParser — buffer accumulation integrity over long streams', () => {
	// Build a stream of `count` records, feed it to a fresh parser one byte at a
	// time, and collect everything. Pins: no record lost, none duplicated, exact
	// stream order — i.e. the append-split-retain buffering has no off-by-one or
	// quadratic corruption no matter how granular the chunking.
	const drainByByte = (count: number): readonly Record<string, unknown>[] => {
		const parser = new NDJSONParser()
		let stream = ''
		for (let index = 0; index < count; index += 1) stream += JSON.stringify({ index }) + LF
		const records: Record<string, unknown>[] = []
		for (const character of stream) records.push(...parser.parse(character))
		return records
	}

	it('emits exactly N records in order for N lines fed one byte at a time', () => {
		const records = drainByByte(250)

		expect(records).toHaveLength(250)
		expect(records.every((record, index) => record['index'] === index)).toBe(true)
	})

	it('emits exactly one record per line across a many-line single chunk', () => {
		const parser = new NDJSONParser()
		let stream = ''
		for (let index = 0; index < 500; index += 1) stream += JSON.stringify({ index }) + LF

		const records = parser.parse(stream)

		expect(records).toHaveLength(500)
		expect(records[0]).toEqual({ index: 0 })
		expect(records[499]).toEqual({ index: 499 })
	})

	it('returns a fresh array each call — no shared accumulator across parses', () => {
		const parser = new NDJSONParser()

		// The return type is `readonly Record<string, unknown>[]`, so the compiler
		// already forbids a caller from mutating it. The runtime guarantee tested here
		// is that each `parse` hands back a DISTINCT array — never one shared, growing
		// accumulator — so an earlier result can never gain later records.
		const first = parser.parse('{"a":1}' + LF)
		const second = parser.parse('{"b":2}' + LF)

		expect(first).not.toBe(second)
		expect(first).toEqual([{ a: 1 }]) // still just its own record
		expect(second).toEqual([{ b: 2 }])
	})

	it('returns an empty array (not the same reference) for empty chunks', () => {
		const parser = new NDJSONParser()

		const first = parser.parse('')
		const second = parser.parse('')

		expect(first).toEqual([])
		expect(second).toEqual([])
		expect(first).not.toBe(second)
	})
})

describe('NDJSONParser — property / invariant suite (chunking invariance)', () => {
	// A realistic Ollama-style multi-line NDJSON corpus — the fixed target for
	// partition-invariance testing. Whatever chunking a wire delivers this stream
	// under, the decoded records must come back identical: no loss, no
	// duplication, no reordering.
	const CORPUS =
		'{"message":{"role":"assistant","content":"The"},"done":false}' +
		LF +
		'{"message":{"role":"assistant","content":" quick"},"done":false}' +
		LF +
		'{"message":{"role":"assistant","content":" brown"},"done":false}' +
		LF +
		'{"message":{"role":"assistant","content":" fox"},"done":false}' +
		LF +
		'not valid json at all' +
		LF +
		'{"message":{"role":"assistant","content":" jumps"},"done":false}' +
		LF +
		'{"message":{"role":"assistant","content":""},"done":true,"eval_count":5}' +
		LF

	const EXPECTED = new NDJSONParser().parse(CORPUS)

	it('sanity: the corpus actually decodes records', () => {
		expect(EXPECTED.length).toBe(5)
	})

	it('every fixed-size and two-way-split chunking of the corpus matches the whole-string parse', () => {
		for (const chunks of chunkings(CORPUS)) {
			const parser = new NDJSONParser()
			expect(feedAll(parser, chunks)).toEqual(EXPECTED)
		}
	})

	it('25 seeded-fuzz random partitions of the corpus all match the whole-string parse', () => {
		const rng = mulberry32(0xc0ffee)

		for (let trial = 0; trial < 25; trial += 1) {
			const chunks = partition(CORPUS, rng)
			const parser = new NDJSONParser()
			expect(feedAll(parser, chunks)).toEqual(EXPECTED)
		}
	})

	it('the exhaustive two-chunk split of a smaller corpus reassembles identically at every cut', () => {
		const small = '{"a":1}' + LF + '{"b":2}' + LF + '{"c":3}' + LF
		const expected = new NDJSONParser().parse(small)

		for (let cut = 0; cut <= small.length; cut += 1) {
			const parser = new NDJSONParser()
			const records = feedAll(parser, [small.slice(0, cut), small.slice(cut)])
			expect(records).toEqual(expected)
		}
	})

	it('byte-at-a-time feeding of the corpus matches the whole-string parse', () => {
		const parser = new NDJSONParser()
		const records: Record<string, unknown>[] = []
		for (const character of CORPUS) records.push(...parser.parse(character))

		expect(records).toEqual(EXPECTED)
	})
})

describe('NDJSONParser — volume / adversarial battery (CI-fast, deterministic)', () => {
	it('reassembles one very long single line (tens of KB) fed byte-at-a-time', () => {
		const payload = 'x'.repeat(50_000)
		const line = JSON.stringify({ payload }) + LF

		const parser = new NDJSONParser()
		const records: Record<string, unknown>[] = []
		for (const character of line) records.push(...parser.parse(character))

		expect(records).toHaveLength(1)
		const [record] = records
		expect(record).toEqual({ payload })
	})

	it('thousands of small records fed in varied chunk sizes: no loss, no duplication, no reorder', () => {
		const count = 3000
		let stream = ''
		for (let index = 0; index < count; index += 1) stream += JSON.stringify({ index }) + LF

		for (const size of [1, 4, 17, 64, 512]) {
			const parser = new NDJSONParser()
			const records: Record<string, unknown>[] = []
			for (let position = 0; position < stream.length; position += size) {
				records.push(...parser.parse(stream.slice(position, position + size)))
			}

			expect(records).toHaveLength(count)
			expect(records.every((record, index) => record['index'] === index)).toBe(true)
		}
	})

	it('interleaved malformed lines within a large volume do not derail subsequent valid records', () => {
		const count = 1000
		let stream = ''
		for (let index = 0; index < count; index += 1) {
			stream += JSON.stringify({ index }) + LF
			if (index % 7 === 0) stream += 'not json ' + String(index) + LF
			if (index % 11 === 0) stream += '[' + String(index) + ']' + LF
		}

		const parser = new NDJSONParser()
		const records: Record<string, unknown>[] = []
		for (let position = 0; position < stream.length; position += 3) {
			records.push(...parser.parse(stream.slice(position, position + 3)))
		}

		expect(records).toHaveLength(count)
		expect(records.every((record, index) => record['index'] === index)).toBe(true)
	})
})
