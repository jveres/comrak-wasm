# Comrak source provenance extension

`comrak/` contains Comrak 0.55.0 from the Cargo registry with its BSD license
in `comrak/COPYING`. The wrapper uses this local dependency so a clean build
does not rely on edits to a developer's Cargo cache.

The extension exports `parse_document_with_source_map` and `SourceLeaf`.
It captures lexical text, code, and shortcode spans after inline parsing but
before `postprocess_text_nodes` merges adjacent text. Literal line offsets
remain available for code inside lists and blockquotes. The ordinary
`parse_document` path does not allocate these records.

Changes to upstream source are confined to `src/lib.rs` and
`src/parser/mod.rs`. The manifest omits example and benchmark targets that
are not part of this vendored library. Rendering and parsing rules remain
upstream rules. `src/source_map.rs` in the wrapper converts the captured
spans into the opt-in HTML source-map contract.

When updating Comrak, reapply this extension before text coalescing and run
the source-map, streaming, and block-snapshot tests. The added API is a
candidate for an upstream contribution rather than a separate Markdown parser.

The 0.55.0 update preserves both extension files unchanged: the upstream
release changes neither `src/lib.rs` nor `src/parser/mod.rs`. The autolink
implementation and its upstream tests include the fixes from
[GHSA-xg9p-p4jc-c46g](https://github.com/kivikakk/comrak/security/advisories/GHSA-xg9p-p4jc-c46g).
