# @orkestrel/ndjson

A minimal streaming NDJSON (newline-delimited JSON) parser — feed it string
chunks as they arrive; each complete `\n`-terminated line is decoded to a
record, and a partial line split across a chunk boundary is buffered until
the rest arrives. A total function — it never throws: a malformed line and a
blank line are silently skipped, and a well-formed but non-object JSON value
(a string, number, array, `null`) is dropped, so `parse()` only ever returns
plain records. `reset()` drops any buffered partial line so the same parser
instance can be reused for a fresh stream.

## Install

```sh
npm install @orkestrel/ndjson
```

## Requirements

- Node.js >= 24
- ESM + CJS (dual-format build)
- One runtime dependency: `@orkestrel/contract`
- A never-terminated line is buffered indefinitely by design — there is no
  size limit, so callers fronting an untrusted or unbounded upstream should
  enforce their own byte cap before feeding chunks in.

## Usage

```ts
import { createNDJSONParser } from '@orkestrel/ndjson'

const parser = createNDJSONParser()
parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
parser.parse('{"c":3}') // [] - buffered until its trailing newline arrives
parser.parse('\n') // [{ c: 3 }]

parser.parse('not json\n\n{"d":4}\n') // [{ d: 4 }] - malformed and blank lines skipped

parser.reset() // drop buffered partial line - reuse for a fresh stream
```

Pair it with a `TextDecoder({ stream: true })` when reading a byte stream so
multi-byte UTF-8 characters split across reads are handled — the decoder
handles partial characters, this parser handles partial lines.

## Guide

For the full surface — the `NDJSONParser` class, its behavior, and the
`createNDJSONParser` factory — see
[`guides/src/ndjson.md`](guides/src/ndjson.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
