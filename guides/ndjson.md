# NDJSON

> A stateful newline-delimited-JSON (NDJSON) stream parser: a self-contained handle
> that turns string chunks into the complete records decoded so far, and never throws
> on a malformed, blank, or non-record line.

`parse(chunk)` appends `chunk` to an internal buffer and splits it on `\n`: every
line before the last is `\n`-terminated, hence complete, and is parsed to a record,
while the final segment is held back for the next call, so a line split across chunk
boundaries is reassembled the moment its closing `\n` arrives. Each trimmed line is
filtered — a blank or whitespace-only line (including one whose only content was a
CRLF's trailing `\r`) is skipped, malformed JSON is skipped silently, and a
non-record value (an array, a primitive, `null`) is dropped — so only plain records
come back, and a line the stream never terminates is never emitted even when the
buffered text already happens to be valid JSON. `clear()` drops the buffered partial
line so a handle can be reused for a fresh stream. Nothing else is wired in: no
Emitter, no server, HTTP, or agent coupling. Pair it with a streaming `TextDecoder`
when reading a byte stream — the decoder handles partial characters, the parser
handles partial lines. The buffer has no size limit, so a caller fronting an
untrusted or unbounded upstream must enforce its own byte cap before feeding chunks
in. Source: [`src/core`](../src/core). Surfaced through the `@src/core` barrel.

## Surface

Create a parser and feed it chunks as they arrive; each `parse(chunk)`
returns the records completed so far, and a trailing partial line is held
for the next call:

```ts
import { createNDJSONParser } from '@orkestrel/ndjson'

const parser = createNDJSONParser()
parser.parse('{"a":1}\n{"b"') // [{ a: 1 }] - the second line is still partial
parser.parse(':2}\n') // [{ b: 2 }] - the split line reassembled
parser.clear() // drop any buffered partial - ready for a fresh stream
```

### Types

A `Shape` cell holds the interface's members in braces.

| Type                    | Kind      | Shape              | Summary                                                                                                                                                                                                                                |
| ----------------------- | --------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NDJSONParserInterface` | interface | `{ parse, clear }` | Represents the stateful NDJSON (newline-delimited JSON) stream-parser contract a consumer holds — a `parse` that turns each string chunk into the complete records decoded so far, and a `clear` that drops the buffered partial line. |

Its `parse` and `clear` members are call-signature methods, documented under
[Methods](#methods).

```ts
import type { NDJSONParserInterface } from '@orkestrel/ndjson'

function feed(parser: NDJSONParserInterface, chunk: string): readonly Record<string, unknown>[] {
	return parser.parse(chunk)
}
```

### Factories

| API                  | Kind     | Summary                                                                                                                                                                                                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createNDJSONParser` | function | Creates an NDJSON (newline-delimited JSON) stream parser and returns it as an `NDJSONParserInterface` — a fresh `NDJSONParser` holding the buffer, so a caller holds the published contract rather than the class. |

```ts
import { createNDJSONParser } from '@orkestrel/ndjson'

const parser = createNDJSONParser()
parser.parse('{"a":1}\n{"b":2}\n') // [{ a: 1 }, { b: 2 }]
```

### Classes

| API            | Kind  | Summary                                                                                                                                                                                                                                                     |
| -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NDJSONParser` | class | Decodes an NDJSON (newline-delimited JSON) stream statefully, implementing `NDJSONParserInterface` over a private buffer the instance owns — each `parse` call returns the records completed so far and reassembles a record split across chunk boundaries. |

## Methods

The public methods of `NDJSONParserInterface` — the class's full method
surface.

#### `NDJSONParserInterface`

| Method  | Returns                              | Summary                                                                                                                                                                                                                                                                                   |
| ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse` | `readonly Record<string, unknown>[]` | Appends `chunk` to the buffer and returns every complete `\n`-terminated line parsed to a record, skipping a malformed or non-record line; the trailing partial line is retained for the next call, so a line split across a chunk boundary is reassembled when its closing `\n` arrives. |
| `clear` | `void`                               | Drops any buffered partial line, leaving the handle ready for a fresh stream.                                                                                                                                                                                                             |

```ts
import { NDJSONParser } from '@orkestrel/ndjson'

const parser = new NDJSONParser()
parser.parse('{"a":1}\n{"b"') // [{ a: 1 }] - the second line is still partial
parser.parse(':2}\n') // [{ b: 2 }] - the split line reassembled
parser.clear() // drop any buffered partial - ready for a fresh stream
parser.parse('{"c":3}\n') // [{ c: 3 }]
```
