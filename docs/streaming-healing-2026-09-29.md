# Streaming healing in v0.6.2

Version 0.6.2 skips structural scans when a healer's delimiter is absent.
The change preserves HTML, cursor placement, and lexical source mappings.
It reduces work most when the active paragraph contains plain prose.

The implementation checks for backticks, link markers, paired delimiters,
single emphasis markers, and display-math delimiters before constructing
structural ranges. It still reanalyzes text after a healer changes it, so mixed
incomplete markup keeps its existing behavior. Link healing also recognizes
an unfinished `](` destination without an opening bracket.

## Parser measurements

Measurements used an Apple M2, Node.js 24.21.0, and the release Wasm build:
Cargo `opt-level = "s"`, LTO, one codegen unit, and `wasm-opt -Oz`. Each workload
streams 96-character prefixes through `mdToStreamingHtmlBlocks` with source
mapping enabled. The table shows the median of three complete passes after
one warmup, compared with the committed v0.6.1 Wasm binary.

| Workload | Prefixes | v0.6.1 | v0.6.2 | Reduction |
| --- | ---: | ---: | ---: | ---: |
| One 40,320-character prose paragraph | 420 | 499.75 ms | 181.75 ms | 63.6% |
| Plain paragraphs | 300 | 170.22 ms | 158.13 ms | 7.1% |
| Rich chat with tables, math, and code | 461 | 896.83 ms | 899.86 ms | No gain |
| Growing code fence | 281 | 49.77 ms | 46.61 ms | 6.4% |

Full snapshot hashes, including block boundaries and mappings, match for
every tested prefix. Both runs finish at 59 Wasm memory pages. These are
parser-only timings; they do not measure browser layout, painting, or scroll
presentation. The rich-chat result does not show a CPU improvement.

## Reproduce and verify

Run the committed synthetic harness after building the package:

```bash
pnpm run build
node bench/streaming-heal.mjs
cargo test --lib
pnpm run check
pnpm test
```

The harness prints compact JSON with machine and runtime versions, Wasm and
fixture hashes, all timing samples, output hashes, and final memory pages.
For a baseline comparison, run the same harness from a separate v0.6.1
checkout using that tag's committed Wasm. Copy only the harness into that
checkout; its relative imports then load the baseline package.

Verification passed 226 Rust tests and 378 Wasm-facing tests, together with
Biome, TypeScript, rustfmt, and Clippy. Two new Rust cases cover unchanged
Unicode and literal markers, plus partial destinations and mixed delimiters.
