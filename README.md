# @orkestrel/ndjson

> A stateful newline-delimited-JSON (NDJSON) stream parser: a self-contained handle
> that turns string chunks into the complete records decoded so far, skips a blank
> line, and refuses a malformed or non-record line unless `strict: false` skips it.

Create a parser with the `createNDJSONParser` function, feed it each chunk as it
arrives, and read the records that call returns; call `clear()` to reuse the same
handle for a fresh stream. Part of the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/ndjson
```

## Requirements

- Node.js >= 22.12
- ESM + CJS (dual-format build)
- Runtime dependency: `@orkestrel/contract`
- A never-terminated line stays in the buffer until its newline arrives,
  unless a refusal in the same call clears the buffer — there is no
  size limit, so when you front an untrusted or unbounded upstream, enforce
  your own byte cap before feeding chunks in.

## Usage

```ts
import { createNDJSONParser } from '@orkestrel/ndjson'

const parser = createNDJSONParser()
parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
parser.parse('{"c":3}') // [] - buffered until its trailing newline arrives
parser.parse('\n') // [{ c: 3 }]

parser.parse('\n\n{"d":4}\n') // [{ d: 4 }] - blank lines skipped
parser.parse('not json\n') // throws an NDJSONError with code 'SYNTAX'

parser.clear() // drop buffered partial line - reuse for a fresh stream

const lenient = createNDJSONParser({ strict: false })
lenient.parse('not json\n\n{"e":5}\n') // [{ e: 5 }] - malformed and blank lines skipped
```

Pair it with a `TextDecoder({ stream: true })` when reading a byte stream so
multi-byte UTF-8 characters split across reads are handled — the decoder
handles partial characters, this parser handles partial lines.

## Guide

For the full surface — the `NDJSONParser` class, its behavior, and the
`createNDJSONParser` factory — see
[`guides/ndjson.md`](guides/ndjson.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
