# Guides

A dual-axis index into this repository's guides — by concept, and by directory (AGENTS §22).

## By concept

| Concept | Spec                             | Source                    | Tests                                 |
| ------- | -------------------------------- | ------------------------- | ------------------------------------- |
| NDJSON  | [`src/ndjson.md`](src/ndjson.md) | [`src/core`](../src/core) | [`tests/src/core`](../tests/src/core) |

## By directory

| Directory  | Guide                            |
| ---------- | -------------------------------- |
| `src/core` | [`src/ndjson.md`](src/ndjson.md) |

## Dependency reference

`@orkestrel/ndjson` has one `@orkestrel/*` runtime dependency:
`@orkestrel/contract`.

[`src/contract.md`](src/contract.md) is a byte-identical mirror of the guide
for `@orkestrel/contract` — the runtime dependency this package's guards /
parsers are built from. It documents **that package's** surface, not
anything sourced in this repo; it is kept here so a reader of this guide
set can see the primitives it depends on without leaving it.

[`src/guide.md`](src/guide.md) is a byte-identical mirror of the guide for
`@orkestrel/guide` — the devDependency powering this repo's guides-parity
test suite (`tests/guides/src/parity.test.ts`). It documents **that
package's** surface (`Guide` / `Source`, the manifest and comparison
helpers), not anything sourced in this repo; it is kept here so a reader of
the parity suite can see the primitives it is built from without leaving
this guide set.

## See also

- [`AGENTS.md`](../AGENTS.md) — the rules; §22 documentation-as-contracts.
