Each item is a chunk that reaches green before the next. An item keeps its number for life: a closed
item leaves this file and its number is never reused, so a commit message citing an item by number
stays true.

- **1.** When a realistic relay frame costs at least 25 ms, or a 256 KB frame split into 1 KB chunks does, replace the repeated tail scan in `NDJSONParser.parse` in `src/core/NDJSONParser.ts`. Benchmark the change, release it, and re-pin consumers in dependency order.
