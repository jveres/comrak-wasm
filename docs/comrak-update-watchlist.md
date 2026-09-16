# Comrak update watchlist

Things to re-check whenever the `comrak` dependency is bumped
(Aug 29, 2026 — collected while building seam's inline formatting on
comrak 0.54.0). Nothing here is filed upstream; check the changelog
instead and retire entries as comrak grows the capability.

Rechecked on September 16, 2026 for Comrak 0.55.0: the entries below still
apply. The autolink denial-of-service fixes do not change the backslash behavior.
The inline parse API, HTML5 spelling, inline escaping, node variants, and
CommonMark printer are unchanged. See the
[0.55 upgrade report](comrak-0.55-upgrade.md) for coverage and measurements.

Before upgrading to 0.56, decide how to preserve or remove the deprecated
`extension.tagfilter` API. It remains functional in this release. It is not an
HTML sanitizer, and consumers must not use it as one.

1. **A public inline-only parse entry** (`parse_inlines` or similar).
   The inline parser (`parser::inlines::Subject::parse_inline`) is
   private; `parse_document` is the only parse entry. This package's
   `mdToInlineHtml` fakes the contract by asserting the parse yields a
   single paragraph and unwrapping `<p>…</p>`. If comrak exposes a
   real inline-only entry, reimplement `mdToInlineHtml` (and consider
   `canonicalizeCommonmarkInline`) on top of it.

2. **Autolink consumes backslash escapes.** With
   `extension.autolink`, `https://x\.co` autolinks WITH the backslash
   swallowed into the destination (`href="https://x%5C.co"`). This
   makes escape-then-parse round-trips of plain-text URLs lossy, and
   is why editors that escape user input must keep autolink off. If a
   comrak update makes autolink respect escapes, editors can turn the
   extension back on.

3. **HTML5 void-tag spelling.** The HTML formatter emits XHTML-style
   `<br />`; `mdToInlineHtml` rewrites it to `<br>` for byte parity
   with DOM serializers. If comrak grows an HTML5-output render
   option, drop the rewrite.

4. **Over-conservative `escape_inline`.** It escapes far more than
   necessary (`.`, `=`, `-`, …), which is why
   `canonicalizeCommonmarkInline` exists (parse + print back for
   minimal escapes). If `escape_inline` becomes minimal, the
   canonicalize entry can thin out.

5. **The `NodeValue` match in `src/ast.rs` is exhaustive on
   purpose** — a comrak upgrade that adds a node type fails the build
   there. When it does: add the variant's mapping (and its payload
   fields) plus a test line, never a `_` arm.

## The commonmark printer is flanking-naive (round-trip breakage)

`format_commonmark` prints emphasis delimiters without checking the
flanking rules its own parser enforces: an AST of `text("cut") +
strong(".")` prints as `cut**.**`, which re-parses as LITERAL
asterisks (an `**` cannot open between a word character and
punctuation — CommonMark §emphasis, left-flanking). The legal
spelling entity-encodes the adjacent word character
(`cu&#116;**.**` parses as bold), but the printer also DECODES such
entities on the way out, destroying the guard. seam works around it
by re-applying its flanking guard after `canonicalizeCommonmarkInline`
(see seam `src/engine/formatting.ts`, `guardFlanking`). On a comrak
update, check whether `format_commonmark` learned flanking-aware
output (then the post-print guard pass can retire).
