import type { Highlighter } from "shiki";

export interface ShikiTheme {
	/** Shiki theme name, e.g. "github-dark". */
	readonly name: string;
	/** Background color for the `<pre>` wrapper. */
	readonly bg: string;
	/** Foreground color for the `<pre>` wrapper. */
	readonly fg: string;
}

/**
 * A comrak `SyntaxHighlighter` constructor. The caller passes it in so the
 * package resolves against the caller's own WASM instance (the playground
 * imports it relatively from `pkg/`, the shiki example via the package name).
 */
export type SyntaxHighlighterCtor<T> = new (
	highlight: (code: string, lang: string | undefined) => string,
	pre: (attrs: Record<string, string>) => string,
	code: (attrs: Record<string, string>) => string,
) => T;

/**
 * Build a comrak `SyntaxHighlighter` backed by a Shiki highlighter.
 *
 * Shiki emits a full `<pre><code>…</code></pre>`; comrak supplies the
 * `<pre>`/`<code>` wrappers via the pre/code callbacks, so the highlight
 * callback extracts just the inner HTML.
 */
export function createShikiAdapter<T>(
	SyntaxHighlighter: SyntaxHighlighterCtor<T>,
	shiki: Highlighter,
	theme: ShikiTheme,
): T {
	return new SyntaxHighlighter(
		(code, lang) => {
			if (!lang) return code;
			try {
				const out = shiki.codeToHtml(code, { lang, theme: theme.name });
				return (
					out.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/)?.[1] ??
					code
				);
			} catch {
				return code;
			}
		},
		(attrs) => {
			const cls = attrs.class ? ` ${attrs.class}` : "";
			return `<pre class="shiki ${theme.name}${cls}" style="background-color:${theme.bg};color:${theme.fg};padding:1em;border-radius:6px;overflow-x:auto">`;
		},
		(attrs) => {
			const cls = attrs.class ? ` class="${attrs.class}"` : "";
			return `<code${cls}>`;
		},
	);
}
