/**
 * Shiki + Comrak WASM — Syntax Highlighting Example
 *
 * Usage:
 *   cd examples/shiki
 *   npm install
 *   npm start
 */

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { initSync, mdToHtmlWithPlugins, SyntaxHighlighter } from "comrak-wasm";
import { createHighlighter } from "shiki";
import { createShikiAdapter } from "../shared/shiki-adapter.ts";

// --- Init WASM ---

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("comrak-wasm/comrak.wasm");
initSync({ module: await readFile(wasmPath) });

// --- Init Shiki ---

const shiki = await createHighlighter({
	themes: ["github-dark"],
	langs: ["typescript", "rust", "bash", "json"],
});

// --- Render markdown ---

const markdown = `\
# Shiki + Comrak Example

Some **bold** text and a [link](https://example.com).

## TypeScript

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\`

## Rust

\`\`\`rust
fn main() {
    let message = "Hello from Rust!";
    println!("{}", message);
}
\`\`\`

## Shell

\`\`\`bash
curl -s https://api.example.com | jq '.data'
\`\`\`

> [!NOTE]
> This example uses Shiki for syntax highlighting with comrak-wasm.
`;

const adapter = createShikiAdapter(SyntaxHighlighter, shiki, {
	name: "github-dark",
	bg: "#24292e",
	fg: "#e1e4e8",
});
let html: string;
try {
	html = mdToHtmlWithPlugins(
		markdown,
		{
			extension: { headerIdPrefix: "", alerts: true },
			render: { unsafe: true },
		},
		adapter,
	);
} finally {
	adapter.free();
	shiki.dispose();
}

// --- Output ---

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shiki + Comrak Example</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #24292e; }
    h1, h2, h3 { margin-top: 1.5em; }
    pre { margin: 1em 0; }
    .markdown-alert { padding: 0.5em 1em; border-left: 4px solid #0969da; background: #ddf4ff; border-radius: 4px; margin: 1em 0; }
    .markdown-alert-title { font-weight: 600; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

const outPath = resolve(import.meta.dirname ?? ".", "output.html");
await writeFile(outPath, page);
console.log(`Written to ${outPath}`);
