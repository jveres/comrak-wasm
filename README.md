# comrak-wasm

WebAssembly bindings for [comrak](https://github.com/kivikakk/comrak), a fast
CommonMark and GitHub Flavored Markdown parser and renderer.

The package runs in browsers, Node.js, Deno, Bun, and edge runtimes. It includes
HTML, CommonMark, XML, plain-text, and ANSI output, plus adapters for syntax
highlighting, headings, code fences, and URL rewriting.

## Install

The package is not published to npm. Install it from GitHub; the built Wasm
artifact is committed, so consumers do not need a Rust toolchain.

```bash
pnpm add github:jveres/comrak-wasm
```

To work on the repository itself, see [Development](#development).

## Initialize

Initialize the Wasm module once before calling any renderer. Concurrent calls
to the default initializer share the same in-flight initialization; the first
call supplies the module input. Do not call `initSync` while asynchronous
initialization is still in progress.

### Browser

```typescript
import init, { mdToHtml } from "comrak-wasm";

await init();

const html = mdToHtml("# Hello **world**", {
  extension: { strikethrough: true, table: true, tasklist: true },
});
```

### Node.js

Use the exported Wasm asset subpath rather than importing generated files from
`pkg`.

```typescript
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync, mdToHtml } from "comrak-wasm";

const require = createRequire(import.meta.url);
const wasm = readFileSync(require.resolve("comrak-wasm/comrak.wasm"));
initSync({ module: wasm });

const html = mdToHtml("# Hello");
```

## Render Markdown

Every renderer accepts Markdown and an optional `ComrakOptions` object.

| Function | Output | Purpose |
| --- | --- | --- |
| `mdToHtml` | HTML | Standard HTML rendering |
| `mdToCommonmark` | Markdown | Normalized CommonMark |
| `mdToXml` | XML | CommonMark XML AST |
| `mdToText` | Plain text | Structural text without styling |
| `mdToAnsi` | ANSI | Styled terminal output |

Malformed runtime options throw an `Error`. Valid fields no longer disappear
silently when another field has the wrong type or value.

```typescript
const html = mdToHtml(markdown, {
  extension: {
    alerts: true,
    autolink: true,
    blockDirective: true,
    footnotes: true,
    headerIdPrefix: "",
    mathDollars: true,
    mathLatex: true,
    strikethrough: true,
    table: true,
    tasklist: true,
  },
  parse: {
    smart: true,
    sourceposChars: true,
  },
  render: {
    alertStyle: "semantic",
    hardbreaks: true,
    sourcepos: true,
  },
});
```

The TypeScript declarations expose the full supported extension, parse, and
render option surface.

### Reuse prepared options

Repeated small renders can avoid deserializing and mapping the same options on
every call. Create a `PreparedOptions` handle once and dispose it when the
calling scope no longer needs it.

```typescript
import { PreparedOptions } from "comrak-wasm";

const renderer = new PreparedOptions({
  extension: { strikethrough: true, table: true },
  render: { compactHtml: true },
});

try {
  const first = renderer.mdToHtml(firstMarkdown);
  const second = renderer.mdToHtml(secondMarkdown);
} finally {
  renderer.free();
}
```

The handle also exposes CommonMark, XML, text, ANSI, frontmatter, and plugin
methods. Use `PreparedCodefenceRenderers` when the same language registry is
rendered repeatedly, and `PreparedAnsiTheme` with `mdToAnsiWithTheme` when the
same custom terminal theme is reused. These handles also own Wasm resources and
must be freed after their last use.

### Attribute options

The bridge supports `headerAttributes`, `fencedCodeAttributes`,
`inlineCodeAttributes`, and `linkAttributes`. Comrak's stock formatters consume
the attribute syntax but do not render or expose the parsed attributes. Use
these flags only when that lossy behavior is acceptable.

## Use Plugins

Plugin adapters are reusable. The public wrapper clones their callback handles
for each Wasm call, so one adapter can render multiple documents.

Plugin callback strings are trusted output. The `render.unsafe` option controls
raw HTML in Markdown; it does not sanitize plugin output. Escape untrusted
values before returning them. If a callback throws or returns a non-string, the
bridge falls back to safe escaped rendering.

Phoenix HEEx is template syntax rather than ordinary raw HTML. Comrak passes
HEEx nodes through even when raw HTML is omitted or escaped. Enable
`phoenixHeex` only for trusted templates.

### Syntax highlighting

This example extracts Shiki's inner code HTML and safely escapes code when
Shiki cannot highlight a language.

```typescript
import { SyntaxHighlighter, mdToHtmlWithPlugins } from "comrak-wasm";
import { createHighlighter } from "shiki";

const shiki = await createHighlighter({
  themes: ["github-dark"],
  langs: ["typescript"],
});

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      })[char] ?? char,
  );

const highlighter = new SyntaxHighlighter(
  (code, lang) => {
    if (!lang) return escapeHtml(code);
    try {
      const highlighted = shiki.codeToHtml(code, {
        lang,
        theme: "github-dark",
      });
      return (
        highlighted.match(
          /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
        )?.[1] ?? escapeHtml(code)
      );
    } catch {
      return escapeHtml(code);
    }
  },
  () => '<pre class="shiki">',
  (attrs) => {
    const className = attrs.class ? escapeHtml(attrs.class) : "";
    return className ? `<code class="${className}">` : "<code>";
  },
);

try {
  const first = mdToHtmlWithPlugins(markdown, options, highlighter);
  const second = mdToHtmlWithPlugins(otherMarkdown, options, highlighter);
} finally {
  highlighter.free();
  shiki.dispose();
}
```

Adapters retain JavaScript callbacks in Wasm. Call `free()` after the last use,
or use `Symbol.dispose` in runtimes that support explicit resource management.

The playground loads its Shiki renderer only when syntax highlighting is
enabled, so highlighting code is absent from the initial JavaScript path.

### Heading adapter

```typescript
import { HeadingAdapter, mdToHtmlWithPlugins } from "comrak-wasm";

const headings = new HeadingAdapter(
  (heading) => `<h${heading.level} class="custom-heading">`,
  (heading) => `</h${heading.level}>`,
);

try {
  const html = mdToHtmlWithPlugins(markdown, options, null, headings);
} finally {
  headings.free();
}
```

### Code-fence renderers

Register trusted renderers for individual code-fence languages.

```typescript
import { mdToHtmlWithCodefenceRenderers } from "comrak-wasm";

const html = mdToHtmlWithCodefenceRenderers(markdown, options, {
  mermaid: (_lang, _meta, code) =>
    `<div class="mermaid">${escapeHtml(code)}</div>`,
});
```

For repeated renders, validate the registry once and use it with prepared
options.

```typescript
import { PreparedCodefenceRenderers, PreparedOptions } from "comrak-wasm";

const optionsHandle = new PreparedOptions(options);
const renderers = new PreparedCodefenceRenderers({
  mermaid: (_lang, _meta, code) =>
    `<div class="mermaid">${escapeHtml(code)}</div>`,
});

try {
  const html = optionsHandle.mdToHtmlWithCodefenceRenderers(
    markdown,
    renderers,
  );
} finally {
  renderers.free();
  optionsHandle.free();
}
```

### URL rewriters

```typescript
import { mdToHtmlWithRewriters } from "comrak-wasm";

const html = mdToHtmlWithRewriters(
  markdown,
  options,
  (url) => `https://images.example/proxy?url=${encodeURIComponent(url)}`,
  (url) => `https://links.example/redirect?url=${encodeURIComponent(url)}`,
);
```

### Broken link callback

Reference links whose label has no definition are normally emitted as literal
text. `parse.brokenLinkCallback` resolves them instead. It rides the options
object, so it applies to every renderer and to `PreparedOptions`.

```typescript
const html = mdToHtml("See [the guide][guide].", {
  parse: {
    brokenLinkCallback: ({ normalized, original }) => {
      const page = wiki.lookup(normalized);
      if (!page) return null; // Leave `[the guide][guide]` as text.
      return { url: page.url, title: original };
    },
  },
});
```

Return a URL string, `{ url, title? }`, or `null`/`undefined`. Thrown
exceptions and non-conforming return values leave the reference unresolved.

## Render Text and ANSI

Plain-text output preserves useful document structure without styling.

````typescript
import { mdToText } from "comrak-wasm";

const text = mdToText(
  markdown,
  options,
  true,  // Append link URLs.
  false, // Hide Markdown markers.
  "░",   // Table shadow character; pass "" to disable it.
);
````

ANSI output supports preset and partial custom themes.

```typescript
import {
  ansiThemeAuto,
  ansiThemeDark,
  ansiThemeLight,
  mdToAnsi,
} from "comrak-wasm";

const ansi = mdToAnsi(markdown, options, {
  ...ansiThemeDark(),
  showMarkdown: true,
  showUrls: true,
  hyperlinks: true,
});

const dark = ansiThemeDark();
const light = ansiThemeLight();
const detected = ansiThemeAuto(process.env.COLORFGBG);
```

For repeated custom-theme rendering, construct `PreparedAnsiTheme` once and
pass it to `mdToAnsiWithTheme` or `PreparedOptions.mdToAnsiWithTheme`.

Text and ANSI rendering include box-drawing tables, alerts, blockquote borders,
lists, footnotes, configurable table shadows, and optional Markdown markers.
Terminal-width calculation handles wide Unicode characters, combining marks,
emoji sequences, CSI styling, and OSC hyperlinks. ANSI rendering strips
terminal control characters supplied by Markdown content and URLs; custom
theme values remain trusted because they intentionally contain ANSI escapes.

`tableShadow` accepts `""` to disable the shadow or one non-control Unicode
scalar value. Decorative table column widths are capped at 256 terminal cells
to bound padding amplification. Cell content is never truncated; an unusually
wide cell can overflow its decorative border.

## Extract Frontmatter

`getFrontmatter` returns raw frontmatter for a parser on the JavaScript side.

```typescript
import { getFrontmatter } from "comrak-wasm";

const raw = getFrontmatter(markdown, {
  extension: { frontMatterDelimiter: "---" },
});
```

It returns `undefined` when the document has no non-empty frontmatter.

## Heal Streaming Markdown

`healMarkdown` closes common incomplete constructs produced during streamed
generation. Its output is idempotent: healing an already healed string does not
change it again.

````typescript
import { healMarkdown } from "comrak-wasm";

healMarkdown("**bold"); // "**bold**"
healMarkdown("```js\ncode"); // "```js\ncode\n```"
healMarkdown("[click](https://example.test");

const html = mdToHtml(healMarkdown(streamChunk), options);
````

The healer covers code fences, inline code, bold, italic, strikethrough, links,
images, block math, setext headings, and incomplete HTML tags.

## Escape Inline Text

`escapeCommonmarkInline` escapes text for literal inclusion in a CommonMark
document at a position where inline parsing occurs — the write direction of a
Markdown-producing editor: user-typed text passes through it so `**`,
`__init__`, or a leading `# ` render as themselves. Comrak escapes more than
strictly necessary; the rendering is unaffected.

```typescript
import { escapeCommonmarkInline, mdToHtml } from "comrak-wasm";

escapeCommonmarkInline("5 * 3, **not bold**"); // "5 \\* 3, \\*\\*not bold\\*\\*"
mdToHtml(escapeCommonmarkInline("# not a heading")); // "<p># not a heading</p>\n"
```

## Use the CLI

The repository includes a small Node.js example.

````bash
pnpm run md -- README.md
pnpm run md -- --text README.md
pnpm run md -- --markdown README.md
pnpm run md -- --no-shadow README.md
echo "# Hello **world**" | pnpm run md -- -
````

## Run the Playground

Start the local playground with:

```bash
pnpm dev
```

Vite prints the local URL. The command does not launch a browser. The playground
supports every output format, explicit Shiki languages and themes, KaTeX, and
light and dark modes. Shiki and KaTeX are disabled initially and loaded on
demand. Its standalone
[`sample.md`](examples/playground/sample.md) fixture exercises every compatible
extension and parser feature. Toolbar modes cover the mutually exclusive
wikilink orders and raw HTML omit, escape, and trusted behavior.

## Development

Install dependencies and build the committed Wasm package before testing Rust
changes.

```bash
pnpm install
pnpm run build
pnpm run verify
```

Useful focused commands include:

```bash
pnpm test
pnpm run test:coverage
pnpm run typecheck
pnpm run check
pnpm run build:playground
pnpm run bench
```

The repository tracks both `pnpm-lock.yaml` and `Cargo.lock`. The pnpm workspace
also includes the Shiki example, so one root install prepares all packages.

### Prerequisites

- Rust with the `wasm32-unknown-unknown` target
- `wasm-bindgen-cli` matching the resolved Rust crate
- Binaryen's `wasm-opt`
- Node.js 22 or newer
- pnpm 11

See the
[latest clean-code and performance audit](docs/audit-2026-07-14.md) for
measurements, completed fixes, and remaining opportunities.

## License

MIT
