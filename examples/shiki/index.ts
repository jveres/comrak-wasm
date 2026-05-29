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
import {
	initSync,
	mdToHtmlWithPlugins,
	SyntaxHighlighter,
} from "@typefm/comrak-wasm";
import { createHighlighter } from "shiki";

// --- Init WASM ---

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("@typefm/comrak-wasm/pkg/comrak.wasm");
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

const html = mdToHtmlWithPlugins(
	markdown,
	{
		extension: { headerIds: "", alerts: true },
		render: { unsafe: true },
	},
	new SyntaxHighlighter(
		(code: string, lang: string | undefined) => {
			if (!lang) return code;
			try {
				const highlighted = shiki.codeToHtml(code, {
					lang,
					theme: "github-dark",
				});
				// Shiki returns <pre><code>...</code></pre>.
				// Extract the inner HTML — comrak calls our pre/code callbacks for the wrappers.
				const match = highlighted.match(
					/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
				);
				return match?.[1] ?? code;
			} catch {
				return code;
			}
		},
		(attrs: Record<string, string>) => {
			const cls = attrs.class ? ` ${attrs.class}` : "";
			return `<pre class="shiki github-dark${cls}" style="background-color:#24292e;color:#e1e4e8;padding:1em;border-radius:6px;overflow-x:auto">`;
		},
		(attrs: Record<string, string>) => {
			const cls = attrs.class ? ` class="${attrs.class}"` : "";
			return `<code${cls}>`;
		},
	),
);

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
