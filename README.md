# @typefm/comrak-wasm

WebAssembly bindings for [comrak](https://github.com/kivikakk/comrak) — a fast CommonMark + GFM compatible Markdown parser and renderer.

Single ~900KB WASM binary. Runs in browsers, Node.js, Deno, Bun, and edge runtimes.

## Install

```bash
npm install @typefm/comrak-wasm
```

## Usage

### Browser

```typescript
import init, { mdToHtml } from "@typefm/comrak-wasm";

await init();

const html = mdToHtml("# Hello **world**", {
  extension: { strikethrough: true, table: true, tasklist: true },
  render: { unsafe: true },
});
```

### Node.js

```typescript
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initSync, mdToHtml } from "@typefm/comrak-wasm";

const require = createRequire(import.meta.url);
const wasm = readFileSync(
  require.resolve("@typefm/comrak-wasm/pkg/comrak.wasm"),
);
initSync({ module: wasm });

const html = mdToHtml("# Hello", {});
```

## Output Formats

| Function         | Output     | Description                    |
| ---------------- | ---------- | ------------------------------ |
| `mdToHtml`       | HTML       | Standard HTML rendering        |
| `mdToCommonmark` | Markdown   | Normalized CommonMark          |
| `mdToXml`        | XML        | CommonMark XML AST             |
| `mdToText`       | Plain text | Structural text, no formatting |
| `mdToAnsi`       | ANSI       | Terminal-colored output        |

All functions accept markdown and an optional `ComrakOptions` object.

## Options

```typescript
mdToHtml(md, {
  extension: {
    strikethrough: true,
    table: true,
    tasklist: true,
    autolink: true,
    alerts: true,
    footnotes: true,
    mathDollars: true,
    headerIdPrefix: "",
    superscript: true,
    underline: true,
    spoiler: true,
    // ... all 28 comrak extension options
  },
  parse: {
    smart: true,
    // ... all 8 parse options
  },
  render: {
    unsafe: true,
    hardbreaks: true,
    sourcepos: true,
    // ... all 17 render options
  },
});
```

## Plugins

### Syntax Highlighting

```typescript
import { SyntaxHighlighter, mdToHtmlWithPlugins } from "@typefm/comrak-wasm";
import { createHighlighter } from "shiki";

const shiki = await createHighlighter({
  themes: ["github-dark"],
  langs: ["typescript"],
});

const html = mdToHtmlWithPlugins(
  markdown,
  options,
  new SyntaxHighlighter(
    (code, lang) => {
      const highlighted = shiki.codeToHtml(code, {
        lang,
        theme: "github-dark",
      });
      return (
        highlighted.match(
          /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
        )?.[1] ?? code
      );
    },
    () => '<pre class="shiki" style="background:#24292e;padding:1em">',
    (attrs) => `<code${attrs.class ? ` class="${attrs.class}"` : ""}>`,
  ),
);
```

### Heading Adapter

```typescript
import { HeadingAdapter, mdToHtmlWithPlugins } from "@typefm/comrak-wasm";

const html = mdToHtmlWithPlugins(
  markdown,
  options,
  null,
  new HeadingAdapter(
    (heading) => `<h${heading.level} id="custom-${heading.content}">`,
    (heading) => `</h${heading.level}>`,
  ),
);
```

### Codefence Renderers

Per-language custom rendering for specific codefence blocks (e.g., mermaid, katex):

```typescript
import { mdToHtmlWithCodefenceRenderers } from "@typefm/comrak-wasm";

const html = mdToHtmlWithCodefenceRenderers(markdown, options, {
  mermaid: (lang, meta, code) => `<div class="mermaid">${code}</div>`,
  katex: (lang, meta, code) =>
    `<div class="katex">${katex.renderToString(code)}</div>`,
});
```

### URL Rewriters

```typescript
import { mdToHtmlWithRewriters } from "@typefm/comrak-wasm";

const html = mdToHtmlWithRewriters(
  markdown,
  options,
  (url) => `https://proxy.example.com?url=${url}`, // image URL rewriter
  (url) => `https://redirect.example.com?url=${url}`, // link URL rewriter
);
```

## Text & ANSI Output

### Plain Text

````typescript
import { mdToText } from "@typefm/comrak-wasm";

const text = mdToText(
  markdown,
  options,
  true, // showUrls — append link URLs as (url)
  false, // showMarkdown — show #, ```, -, **, * etc. (default: false)
  "░", // tableShadow — shadow character (default: ░)
);
````

### ANSI Terminal

```typescript
import { mdToAnsi, ansiThemeDark, ansiThemeLight } from "@typefm/comrak-wasm";

// Default theme (showMarkdown off, showUrls on, table shadow on)
const ansi = mdToAnsi(markdown, options);

// Custom theme
const ansi = mdToAnsi(markdown, options, {
  heading: "\x1b[1;34m",
  headingH1: "\x1b[1;4;35m",
  bold: "\x1b[1m",
  code: "\x1b[33m",
  codeBlock: "\x1b[32m",
  link: "\x1b[4;34m",
  showMarkdown: true,
  showUrls: true,
  tableShadow: "░",
});

// Preset themes (light uses a distinct inline-code palette for light backgrounds)
const dark = ansiThemeDark();
const light = ansiThemeLight();
```

Features:

- Box-drawing tables with column alignment and inline formatting
- Table drop shadow (configurable character)
- Colored alert badges (Note, Tip, Warning, Caution, Important)
- Blockquote `│` borders with italic text
- List bullets always visible (ordered numbers + unordered dashes)
- Footnote definitions rendered at bottom
- `showMarkdown` toggle for structural markers (`#`, ` ``` `, `**`, `*`, `` ` ``)
- Configurable theme (all ANSI codes customizable)

## Frontmatter Extraction

Extract raw frontmatter content (YAML, TOML, etc.) for parsing on the JS side:

```typescript
import { getFrontmatter } from "@typefm/comrak-wasm";

const raw = getFrontmatter(markdown, {
  extension: { frontMatterDelimiter: "---" },
});
// "title: Hello\ndate: 2026-01-01"

// Parse with your preferred library
const data = yaml.parse(raw);
```

Returns `undefined` if no frontmatter is present.

## Markdown Healing

Fix incomplete markdown from LLM streaming — closes unclosed delimiters:

````typescript
import { healMarkdown } from "@typefm/comrak-wasm";

healMarkdown("**bold"); // → "**bold**"
healMarkdown("```js\ncode"); // → "```js\ncode\n```"
healMarkdown("~~strike"); // → "~~strike~~"
healMarkdown("[click](http://x"); // → "[click](http://x)"
healMarkdown("$$\nx^2"); // → "$$\nx^2\n$$"

// Use with any renderer
const html = mdToHtml(healMarkdown(streamChunk), options);
````

Handles: code fences, bold, italic, strikethrough, inline code, links/images, KaTeX math, setext headings, incomplete HTML tags.

## CLI

Render markdown in the terminal via `npx`:

````bash
# ANSI colored output (default)
npx @typefm/comrak-wasm README.md

# Plain text output
npx @typefm/comrak-wasm --text README.md

# Show markdown markers (#, ```, **, etc.)
npx @typefm/comrak-wasm --markdown README.md

# Disable table shadow
npx @typefm/comrak-wasm --no-shadow README.md

# Read from stdin
echo "# Hello **world**" | npx @typefm/comrak-wasm -

# Combine options
npx @typefm/comrak-wasm -t -m --no-shadow README.md
````

Or if installed globally / in a project, use the `comrak-wasm` command directly:

```bash
comrak-wasm README.md
```

## Playground

```bash
npm run dev
```

Opens a live playground with all output formats, Shiki syntax highlighting, KaTeX math rendering, and dark/light theme support.

## Development

```bash
# Build WASM
npm run build

# Run tests (vitest)
npm test

# Lint & format (biome)
npm run check

# Type check
npm run typecheck
```

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [wasm-bindgen-cli](https://rustwasm.github.io/wasm-bindgen/)
- Node.js 22+

## License

MIT
