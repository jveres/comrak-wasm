---
title: Comrak feature playground
description: Exhaustive Markdown fixture for the browser demo
tags:
  - CommonMark
  - GFM
  - extensions
---

# Comrak feature playground {#top .feature-heading data-scope=all}

This editable document exercises the Markdown features exposed by the
TypeScript API across HTML, CommonMark, XML, text, and ANSI output.

## Core CommonMark

"Smart punctuation" turns straight quotes into curly quotes, converts
three dots ... into an ellipsis, and converts -- into an en dash.

This soft line break
renders as a hard break in HTML.

Escaped character spans remain identifiable: notify \@example.

Setext heading with attributes {#setext .alternate-heading}
------------------------------------------------------------

Paragraphs can contain **bold**, *italic*, ***bold italic***,
`inline code`, [links](https://commonmark.org), and
![images][figure].

> A blockquote can contain **formatted text**.
>
> > Blockquotes can be nested.

1. Ordered item
2. Another item
   - Nested unordered item
   - A second nested item

---

## GFM features

Strikethrough renders ~~deleted text~~ and autolinks detect
www.example.com, hello@example.com, and [https://example.com/in-brackets].

- [x] Standard completed task
- [ ] Standard pending task
- [!] Relaxed task marker

| Alignment | Inline formatting | Task in table |
| :--- | :---: | ---: |
| left | **bold** and `code` | [ ] |
| wide text | 好 and é | [x] |

The tag filter escapes disallowed raw tags even in trusted mode:
<xmp>this xmp tag is filtered</xmp>

## Comrak inline extensions

- Superscript: e = mc^2^
- Subscript: H~2~O
- Underline: __underlined text__
- Highlight: ==important text==
- Insert: ++added text++
- Spoiler: ||the answer is 42||
- Emoji shortcodes: :rocket: :sparkles: :crab:

-# Subtext uses its own block-level marker.

CJK-friendly emphasis recognizes
**この文は重要です。**但这句话并不重要。

>greentext stays literal because there is no space after the marker.

The GFM quirks renderer normalizes ****nested bold**** while preserving
ordinary *_nested emphasis_*.

## Alerts

> [!NOTE]
> Notes use the selected semantic alert style.

> [!TIP]
> Switch output formats to inspect the same syntax.

> [!IMPORTANT]
> Source positions count Unicode characters.

> [!WARNING]
> Plugin callback output is trusted HTML.

> [!CAUTION]
> Raw HTML has omit, escape, and trusted modes.

## Footnotes

Reference footnotes work across the document.[^reference]
Inline footnotes work too.^[This is an *inline* footnote.]

[^reference]: The referenced footnote contains **formatting**.
[^unreferenced]: This definition is intentionally unreferenced.

## Description lists

Comrak

: A CommonMark and GFM parser written in Rust.

WebAssembly

: A portable compilation target used by this package.

## Math

Dollar math supports inline $E = mc^2$ and display blocks:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

LaTeX delimiters support inline \(a^2 + b^2 = c^2\) and display
\[\sum_{i=1}^{n} i = \frac{n(n+1)}{2}\].

Code math supports inline $`1 + 2`$ and display fences:

```math
x^2 + y^2
```

Chemistry is rendered by the playground's KaTeX mhchem plugin:
$\ce{2H2 + O2 -> 2H2O}$.

## Code fences and parsed attributes

```typescript demo-metadata {#typed-example .featured data-owner=playground}
interface Feature {
  name: string;
  enabled: boolean;
}

const feature: Feature = { name: "attributes", enabled: true };
```

The default info string applies to an otherwise unlabeled fence:

```
plain fallback code
```

Inline code attributes are parsed from
`const answer = 42`{.typescript data-kind=example}.

Heading, code-fence, inline-code, link, and image attributes are consumed by
Comrak's parser. Stock formatters intentionally do not expose the metadata.

[Attributed link](https://example.com){rel=nofollow data-kind=demo}

![Attributed image][attrs-figure]{data-kind=demo}

## Block directives

:::warning
A container block directive can hold paragraphs and lists.

- First directive item
- Second directive item
:::

## Multiline block quotes

>>>
This quote can span multiple paragraphs without repeating the marker.

- It can contain lists.
- It can contain **inline markup**.
>>>

## Wikilinks

URL-first mode: [[/guides/comrak|Comrak guide]]

Title-first mode: [[Comrak guide|/guides/comrak]]

Use the toolbar selector to choose which mutually exclusive pipe order is
interpreted as the canonical form.

## Phoenix HEEx

<.link navigate={~p"/docs"}>HEEx component link</.link>

Current user: <%= @current_user.name %>

HEEx passes through every raw HTML mode, so enable it only for trusted
templates. Text and ANSI output omit HEEx nodes.

## Raw HTML and empty links

<details>
<summary>Trusted raw HTML</summary>
This content is inside a native details element.
</details>

The empty link option leaves this literal instead of emitting an anchor: []().

## Source position Unicode

The character 好 occupies one source-position column when character-based
source positions are enabled.

*Built with* `comrak` *+* `wasm-bindgen`

[figure]: https://placehold.co/240x80?text=Comrak "Figure caption"
[attrs-figure]: https://placehold.co/240x80?text=Attrs "Attributed figure"
