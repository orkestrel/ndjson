# @orkestrel/ndjson

> A stateful newline-delimited-JSON (NDJSON) stream parser: a self-contained handle
> that turns string chunks into the complete records decoded so far, and never throws
> on a malformed, blank, or non-record line.

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
- A never-terminated line stays in the buffer until its newline arrives —
  there is no size limit, so when you front an untrusted or unbounded
  upstream, enforce your own byte cap before feeding chunks in.

## Usage

```ts
import { createNDJSONParser } from '@orkestrel/ndjson'

const parser = createNDJSONParser()
parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
parser.parse('{"c":3}') // [] - buffered until its trailing newline arrives
parser.parse('\n') // [{ c: 3 }]

parser.parse('not json\n\n{"d":4}\n') // [{ d: 4 }] - malformed and blank lines skipped

parser.clear() // drop buffered partial line - reuse for a fresh stream
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
