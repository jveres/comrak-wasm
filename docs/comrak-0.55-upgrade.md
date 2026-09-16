# Comrak 0.55 upgrade — September 16, 2026

Comrak-wasm 0.4.0 vendors Comrak 0.55.0 and exposes parsed attributes in
`mdToAst`. This is an additive wrapper API release. Existing rendering defaults
and the opt-in source-map contract remain unchanged.

## Upstream scope

[Comrak 0.55.0](https://github.com/kivikakk/comrak/releases/tag/v0.55.0),
released September 6, fixes recursive email autolinking and quadratic URL
delimiter scanning. The latter is tracked in
[GHSA-xg9p-p4jc-c46g](https://github.com/kivikakk/comrak/security/advisories/GHSA-xg9p-p4jc-c46g).
It also deprecates `tagfilter`, with removal planned for 0.56. There are no
new Markdown node types or option fields in 0.55.

All 36 extension, 10 parse, and 18 render fields are covered by the wrapper;
the two URL-rewriter extension fields use the callback APIs. Features introduced
in 0.54 already have coverage: LaTeX delimiters, block directives, semantic
alerts, heading IDs, character-based source positions, and attribute parsing.
The attribute AST payload was the missing public capability.

The upstream changes do not touch `vendor/comrak/src/lib.rs` or
`vendor/comrak/src/parser/mod.rs`, which contain our source-map extension.
Both files are retained unchanged. The compiled WASM includes the new parser.
The optional CLI dependency update does not affect this library build; the
locked emoji dependency was already current.

## Compatibility

`AstNode.attributes` is optional. Its `id` is optional, `classes` retains order
and duplicates, and `pairs` stores arbitrary name/value pairs without collapsing
duplicate keys. The last parsed ID wins, following upstream behavior.
The four attribute extensions remain opt-in. Attributes are data, not trusted
HTML: this release does not apply them to rendered elements.

`extension.tagfilter` still works, with the same default and streaming behavior.
Its TypeScript declaration is deprecated. Warning suppression is scoped to the
two Rust compatibility uses; other deprecation warnings remain enabled.
Existing sanitization must remain in place.

## Regression coverage

`upgrade.test.ts` adds attribute cases for ATX/setext headings, fenced/inline
code, links, and images. It checks omission when disabled, Unicode, duplicate
keys/classes, arbitrary keys, and 100 seeded property-based order checks.

Source ownership is checked at every UTF-16 cut of a mixed Unicode, emphasis,
email, and URL fixture. Both source-position modes and static/streaming mapped
output must match the unmapped render and preserve text ownership.

Hostile inputs run in separate Node processes with a 10-second hard timeout.
The worker checks HTML, prepared options, block snapshots, source maps,
streaming, plain text, ANSI, CommonMark round trips, XML, and AST output:

- 10,000 repeated email addresses.
- A URL followed by 100,000 closing parentheses, brackets, or braces.

With 0.54, the email case trapped with a stack overflow; each delimiter case
hit the timeout. With 0.55, all four workers complete and their output assertions
pass. These checks bound known regressions, not every possible hostile input.

Verification: 321 JavaScript tests, 203 wrapper Rust tests, direct type-checking
of the added test, formatting, Clippy with warnings denied, optimized WASM build,
and playground production build. Upstream autolink regression tests are also
retained in the vendored source.

## Measurements

The existing `bench/wasm.mjs` ran before and after the upgrade on Apple M2,
macOS Darwin 27 arm64, Node 22.21.1. Both binaries used the same release profile:
`opt-level = "s"`, LTO, and one codegen unit. Each case uses one warmup and seven
samples, with the default 2 MiB work target. These are sequential parser/WASM
measurements, not browser frame-time or physical scrolling measurements.

| Measure | 0.54 baseline | 0.55 upgrade |
| --- | ---: | ---: |
| WASM bytes | 1,001,925 | 1,003,654 |
| Mixed 16.2 KiB HTML, median | 1,321.73 µs | 1,356.40 µs |
| Mixed 16.2 KiB text, median | 1,265.78 µs | 1,299.55 µs |
| Tiny HTML, prepared options | 1.28 µs | 1.28 µs |
| 1,000 × 10 table text, median | 81.76 ms | 82.19 ms |
| Table WASM pages, before → after | 25 → 100 | 25 → 100 |

The binary grows by 1,729 bytes (0.17%). Mixed rendering is about 2.6% slower
in this pair; this does not establish a general performance regression or
speedup. All 30 benchmark output hashes match. No additional WASM page growth
appears in the measured table case. These measurements do not measure peak
native allocation or attribute-heavy AST performance.

Baseline WASM SHA-256:
`25b7610883d426a40899cedf702c61d3497851ab76a225b0e067ae1d7392ab74`.
Upgrade WASM SHA-256:
`ddecad374faba74a44699be7f196cc347cb304daa45eada81caa176938518baa`.

To repeat against two checkouts, build each with the same toolchain and run
`COMRAK_BENCH_JSON=1 node bench/wasm.mjs`. Keep raw logs locally; this report
records the durable comparison. Baseline metadata marked the checkout dirty
because the new regression tests were present before the parser changed.
