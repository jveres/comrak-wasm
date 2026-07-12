export interface ShikiTheme {
	/** Shiki theme name, e.g. "github-dark". */
	readonly name: string;
	/** Background color for the `<pre>` wrapper. */
	readonly bg: string;
	/** Foreground color for the `<pre>` wrapper. */
	readonly fg: string;
}

export interface ShikiHighlighter {
	codeToHtml(
		code: string,
		options: { readonly lang: string; readonly theme: string },
	): string;
}

/**
 * A comrak `SyntaxHighlighter` constructor. The caller passes it in so the
 * package resolves against the caller's own Wasm instance.
 */
export type SyntaxHighlighterCtor<T> = new (
	highlight: (code: string, lang: string | undefined) => string,
	pre: (attrs: Record<string, string>) => string,
	code: (attrs: Record<string, string>) => string,
) => T;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#x27;";
			default:
				return character;
		}
	});
}

function renderAttributes(attributes: Record<string, string>): string {
	return Object.entries(attributes)
		.filter(([name]) => /^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name))
		.map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
		.join("");
}

/**
 * Build a comrak `SyntaxHighlighter` backed by a Shiki highlighter.
 *
 * Shiki emits a full `<pre><code>…</code></pre>`; comrak supplies the
 * `<pre>`/`<code>` wrappers via the pre/code callbacks, so the highlight
 * callback extracts just the inner HTML.
 */
export function createShikiAdapter<T>(
	SyntaxHighlighter: SyntaxHighlighterCtor<T>,
	shiki: ShikiHighlighter,
	theme: ShikiTheme,
): T {
	const themeName = escapeHtml(theme.name);
	const background = escapeHtml(theme.bg);
	const foreground = escapeHtml(theme.fg);

	return new SyntaxHighlighter(
		(code, lang) => {
			if (!lang) return escapeHtml(code);
			try {
				const out = shiki.codeToHtml(code, { lang, theme: theme.name });
				return (
					out.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/)?.[1] ??
					escapeHtml(code)
				);
			} catch {
				return escapeHtml(code);
			}
		},
		(attrs) => {
			const { class: className, ...otherAttributes } = attrs;
			const cls = className ? ` ${escapeHtml(className)}` : "";
			return `<pre class="shiki ${themeName}${cls}"${renderAttributes(otherAttributes)} style="background-color:${background};color:${foreground};padding:1em;border-radius:6px;overflow-x:auto">`;
		},
		(attrs) => {
			const { class: className, ...otherAttributes } = attrs;
			const cls = className ? ` class="${escapeHtml(className)}"` : "";
			return `<code${cls}${renderAttributes(otherAttributes)}>`;
		},
	);
}
