import { readFile } from "node:fs/promises";
import type { HeadingMeta } from "comrak-wasm";
import {
	ansiThemeAuto,
	ansiThemeDark,
	ansiThemeLight,
	comrakVersion,
	detectColorScheme,
	getFrontmatter,
	HeadingAdapter,
	healMarkdown,
	initSync,
	mdToAnsi,
	mdToAnsiWithTheme,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithCodefenceRenderers,
	mdToHtmlWithPlugins,
	mdToHtmlWithRewriters,
	mdToHtmlWithRewritersAndPlugins,
	mdToText,
	mdToXml,
	mdToXmlWithPlugins,
	PreparedAnsiTheme,
	PreparedCodefenceRenderers,
	PreparedOptions,
	SyntaxHighlighter,
} from "comrak-wasm";
import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import {
	extensionFeatureCoverage,
	parseFeatureCoverage,
	renderFeatureCoverage,
} from "./examples/playground/feature-coverage";
import { createPlaygroundOptions } from "./examples/shared/options.js";
import {
	createShikiAdapter,
	type ShikiHighlighter,
} from "./examples/shared/shiki-adapter";

const invalidStringCallbacks: ReadonlyArray<{
	description: string;
	callback: () => string;
}> = [
	{
		description: "throws",
		callback: () => {
			throw new Error("callback failed");
		},
	},
	{
		description: "returns a non-string",
		callback: (() => 42) as unknown as () => string,
	},
];

let wasmMemory: WebAssembly.Memory;

beforeAll(async () => {
	const wasmBytes = await readFile(
		new URL("./pkg/comrak.wasm", import.meta.url),
	);
	const instance = initSync({ module: wasmBytes });
	wasmMemory = instance.memory;
});

// --- Core ---

describe("core", () => {
	test("comrakVersion returns the upgraded Comrak release", () => {
		expect(comrakVersion()).toMatch(/^0\.54\./);
	});

	test("empty input", () => {
		expect(mdToHtml("", {})).toBe("");
	});

	test("empty input commonmark", () => {
		expect(mdToCommonmark("", {})).toBe("");
	});
});

// --- Playground Feature Fixture ---

describe("playground feature fixture", () => {
	test("tracks every public option in a compile-time coverage inventory", () => {
		expect(Object.keys(extensionFeatureCoverage)).toHaveLength(35);
		expect(Object.keys(parseFeatureCoverage)).toHaveLength(9);
		expect(Object.keys(renderFeatureCoverage)).toHaveLength(18);
	});

	test("exercises the complete compatible feature profile", async () => {
		const markdown = await readFile(
			new URL("./examples/playground/sample.md", import.meta.url),
			"utf8",
		);
		const options = createPlaygroundOptions(true, "trusted", "url-first");
		const html = mdToHtml(markdown, options);
		const commonmark = mdToCommonmark(markdown, options);

		expect(html).toContain("<del");
		expect(html).toContain("&lt;xmp>");
		expect(html).toContain("<table");
		expect(html).toContain('href="http://www.example.com"');
		expect(html).toContain("Relaxed task marker");
		expect(html).toContain("<sup");
		expect(html).toContain('id="feature-comrak-feature-playground"');
		expect(html).toContain('href="#feature-comrak-feature-playground"');
		expect(html).toContain("__inline_");
		expect(html).toContain('class="footnotes"');
		expect(html).toContain("<dl");
		expect(html).not.toContain("tags:");
		expect(html).toContain("This quote can span multiple paragraphs");
		expect(html.match(/<aside class="admonition/g)).toHaveLength(5);
		expect(html.match(/data-math-style/g)?.length).toBeGreaterThanOrEqual(7);
		expect(html).toContain("🚀 ✨ 🦀");
		expect(html).toContain('data-wikilink="true"');
		expect(html).toContain("<u");
		expect(html).toContain("<sub");
		expect(html).toContain('class="spoiler"');
		expect(html).toContain("&gt;greentext stays literal");
		expect(html).toContain("この文は重要です。</strong>");
		expect(html).toContain("<mark");
		expect(html).toContain("<ins");
		expect(html).toContain("HEEx component link");
		expect(html).toContain('<div class="warning"');
		expect(html).not.toContain("data-owner=playground");
		expect(html).not.toContain("{.typescript data-kind=example}");

		expect(html).toContain("“Smart punctuation”");
		expect(html).toContain("…");
		expect(html).toContain("–");
		expect(html).toContain('href="https://example.com/in-brackets"');
		expect(html).toContain("data-escaped-char");
		expect(html).toContain("data-sourcepos");
		expect(html).toContain("<br");
		expect(html).toMatch(/<pre[^>]*data-meta="demo-metadata"/);
		expect(html).toMatch(/<pre[^>]*lang="text"/);
		expect(html).toContain("[]()");
		expect(html).toContain("<strong");
		expect(html).toContain("<figure>");
		expect(html).toContain('class="contains-task-list"');
		expect(html).toContain('<aside class="admonition note"');

		expect(commonmark).toContain("+ Nested unordered item");
		expect(commonmark).toContain("```typescript demo-metadata");

		const titleFirst = createPlaygroundOptions(true, "trusted", "title-first");
		expect(titleFirst.extension?.wikilinksTitleAfterPipe).toBe(false);
		expect(titleFirst.extension?.wikilinksTitleBeforePipe).toBe(true);
		expect(mdToHtml(markdown, titleFirst)).toContain(
			'href="/guides/comrak" data-wikilink="true">Comrak guide</a>',
		);

		const escaped = mdToHtml(
			markdown,
			createPlaygroundOptions(true, "escape", "url-first"),
		);
		expect(escaped).toContain("&lt;details&gt;");
		expect(escaped).not.toContain("<details>");
		expect(escaped).toContain("<%= @current_user.name %>");

		const omitted = mdToHtml(
			markdown,
			createPlaygroundOptions(true, "omit", "url-first"),
		);
		expect(omitted).toContain("<!-- raw HTML omitted -->");
		expect(omitted).toContain("<%= @current_user.name %>");
	});
});

// --- HTML ---

describe("html", () => {
	test("basic markdown", () => {
		expect(mdToHtml("# Hello\n\nworld", {})).toBe(
			"<h1>Hello</h1>\n<p>world</p>\n",
		);
	});

	test("inline formatting", () => {
		const html = mdToHtml("**bold** *italic* `code`", {});
		expect(html).toContain("<strong>bold</strong>");
		expect(html).toContain("<em>italic</em>");
		expect(html).toContain("<code>code</code>");
	});

	test("no options (undefined)", () => {
		expect(mdToHtml("hello", undefined)).toBe("<p>hello</p>\n");
	});

	test("no options (null)", () => {
		expect(mdToHtml("hello", null)).toBe("<p>hello</p>\n");
	});

	test("unsafe html rendering", () => {
		expect(mdToHtml("<div>raw</div>", { render: { unsafe: true } })).toContain(
			"<div>raw</div>",
		);
	});

	test("html filtered by default", () => {
		expect(mdToHtml("<div>raw</div>", {})).not.toContain("<div>raw</div>");
	});

	test("hardbreaks", () => {
		expect(
			mdToHtml("line1\nline2", { render: { hardbreaks: true } }),
		).toContain("<br");
	});

	test("sourcepos", () => {
		expect(mdToHtml("hello", { render: { sourcepos: true } })).toContain(
			"data-sourcepos",
		);
	});

	test("compact html", () => {
		const html = mdToHtml("# Title\n\nParagraph", {
			render: { compactHtml: true, unsafe: true },
		});
		expect(html).not.toContain("\n<p>");
	});

	test.each([
		{ description: "negative", width: -1 },
		{ description: "fractional", width: 1.5 },
		{ description: "NaN", width: Number.NaN },
		{ description: "wrong-type", width: "80" },
	])("rejects $description numeric options", ({ width }) => {
		const renderWithUncheckedOptions = mdToHtml as unknown as (
			markdown: string,
			options: unknown,
		) => string;

		expect(() =>
			renderWithUncheckedOptions("hello", { render: { width } }),
		).toThrow(/invalid comrak options/);
	});

	test.each([
		{ description: "alert style", render: { alertStyle: "visual" } },
		{ description: "list style", render: { listStyle: "bullet" } },
	])("rejects unsupported $description", ({ render }) => {
		const renderWithUncheckedOptions = mdToHtml as unknown as (
			markdown: string,
			options: unknown,
		) => string;

		expect(() => renderWithUncheckedOptions("hello", { render })).toThrow(
			/invalid comrak options/,
		);
	});
});

describe("prepared options", () => {
	test("reuses one validated option set across stock renderers", () => {
		const prepared = new PreparedOptions({
			extension: {
				frontMatterDelimiter: "---",
				strikethrough: true,
				table: true,
			},
		});

		try {
			expect(prepared.mdToHtml("~~done~~")).toContain("<del>done</del>");
			expect(prepared.mdToCommonmark("# Title")).toBe("# Title\n");
			expect(prepared.mdToXml("# Title")).toContain('<heading level="1"');
			expect(prepared.mdToText("# Title")).toBe("Title");
			expect(prepared.mdToAnsi("# Title")).toContain("Title");
			expect(prepared.getFrontmatter("---\ntitle: Ready\n---\nBody")).toBe(
				"title: Ready",
			);
		} finally {
			prepared.free();
		}
	});

	test("rejects malformed options at construction", () => {
		const PreparedOptionsUnchecked = PreparedOptions as unknown as new (
			options: unknown,
		) => PreparedOptions;

		expect(
			() => new PreparedOptionsUnchecked({ render: { width: -1 } }),
		).toThrow(/invalid comrak options/);
	});

	test("reuses options with reusable plugin adapters", () => {
		const prepared = new PreparedOptions({ render: { unsafe: true } });
		const highlighter = new SyntaxHighlighter(
			(code, language) => `<mark data-language="${language}">${code}</mark>`,
			() => "<pre>",
			() => "<code>",
		);

		try {
			const first = prepared.mdToHtmlWithPlugins(
				"```js\none\n```",
				highlighter,
			);
			const second = prepared.mdToHtmlWithPlugins(
				"```rust\ntwo\n```",
				highlighter,
			);
			expect(first).toContain('data-language="js"');
			expect(second).toContain('data-language="rust"');
		} finally {
			highlighter.free();
			prepared.free();
		}
	});

	test("reuses validated code-fence renderer registrations", () => {
		const prepared = new PreparedOptions({ render: { unsafe: true } });
		const renderers = new PreparedCodefenceRenderers({
			mermaid: (_language, _meta, code) => `<figure>${code}</figure>`,
		});

		try {
			expect(
				prepared.mdToHtmlWithCodefenceRenderers(
					"```mermaid\ngraph TD\n```",
					renderers,
				),
			).toContain("<figure>graph TD\n</figure>");
		} finally {
			renderers.free();
			prepared.free();
		}
	});

	test("reuses a validated and merged ANSI theme", () => {
		const options = { extension: { table: true } };
		const themeOptions = { ...ansiThemeDark(), showMarkdown: true };
		const theme = new PreparedAnsiTheme(themeOptions);
		const prepared = new PreparedOptions(options);

		try {
			const markdown = "# Ready";
			const expected = mdToAnsi(markdown, options, themeOptions);
			expect(mdToAnsiWithTheme(markdown, options, theme)).toBe(expected);
			expect(prepared.mdToAnsiWithTheme(markdown, theme)).toBe(expected);
		} finally {
			theme.free();
			prepared.free();
		}
	});

	test("rejects malformed prepared renderer and theme registrations", () => {
		const PreparedRenderersUnchecked =
			PreparedCodefenceRenderers as unknown as new (
				renderers: unknown,
			) => PreparedCodefenceRenderers;

		expect(
			() => new PreparedRenderersUnchecked({ rust: "not a function" }),
		).toThrow('codefence renderer for "rust" must be a Function');
		expect(() => new PreparedAnsiTheme({ tableShadow: "too long" })).toThrow(
			"tableShadow must be empty or one non-control Unicode scalar value",
		);
	});
});

// --- Extensions ---

describe("extensions", () => {
	test("strikethrough", () => {
		expect(
			mdToHtml("~~deleted~~", { extension: { strikethrough: true } }),
		).toContain("<del>deleted</del>");
	});

	test("strikethrough disabled by default", () => {
		expect(mdToHtml("~~deleted~~", {})).not.toContain("<del>");
	});

	test("table", () => {
		const html = mdToHtml("| a | b |\n|---|---|\n| 1 | 2 |", {
			extension: { table: true },
		});
		expect(html).toContain("<table>");
		expect(html).toContain("<td>1</td>");
	});

	test("tasklist", () => {
		const html = mdToHtml("- [x] done\n- [ ] todo", {
			extension: { tasklist: true },
		});
		expect(html).toContain('type="checkbox"');
		expect(html).toContain("checked");
	});

	test("autolink", () => {
		expect(
			mdToHtml("Visit https://example.com today", {
				extension: { autolink: true },
			}),
		).toContain('href="https://example.com"');
	});

	test("footnotes", () => {
		const html = mdToHtml("Text[^1]\n\n[^1]: Footnote content", {
			extension: { footnotes: true },
		});
		expect(html).toContain('class="footnote-ref"');
		expect(html).toContain("Footnote content");
	});

	test("alerts", () => {
		const html = mdToHtml("> [!NOTE]\n> Important info", {
			extension: { alerts: true },
		});
		expect(html).toContain("markdown-alert");
		expect(html).toContain("markdown-alert-note");
	});

	test("semantic alert style", () => {
		const html = mdToHtml("> [!NOTE]\n> Important info", {
			extension: { alerts: true },
			render: { alertStyle: "semantic" },
		});
		expect(html).toContain('<aside class="admonition note">');
		expect(html).toContain('class="admonition-title"');
	});

	test("math dollars inline", () => {
		expect(
			mdToHtml("Inline $x^2$ here", { extension: { mathDollars: true } }),
		).toContain('data-math-style="inline"');
	});

	test("math dollars display", () => {
		expect(
			mdToHtml("$$\nE = mc^2\n$$", { extension: { mathDollars: true } }),
		).toContain('data-math-style="display"');
	});

	test("LaTeX math delimiters", () => {
		const html = mdToHtml(String.raw`Inline \(x^2\) and \[E = mc^2\]`, {
			extension: { mathLatex: true },
		});
		expect(html).toContain('<span data-math-style="inline">x^2</span>');
		expect(html).toContain('<span data-math-style="display">E = mc^2</span>');
	});

	test("block directives", () => {
		const html = mdToHtml(":::warning\nRead this.\n:::", {
			extension: { blockDirective: true },
		});
		expect(html).toContain('<div class="warning">');
		expect(html).toContain("<p>Read this.</p>");
	});

	test("block directives preserve text and ANSI content", () => {
		const markdown = ":::warning\nRead this.\n:::";
		const options = { extension: { blockDirective: true } };

		expect(mdToText(markdown, options)).toBe("Read this.");
		expect(mdToAnsi(markdown, options)).toBe("Read this.");
	});

	test("heading attributes are parsed", () => {
		const html = mdToHtml("# Hi! {#greeting}", {
			extension: { headerAttributes: true },
		});
		expect(html).toBe("<h1>Hi!</h1>\n");
	});

	test("fenced code attributes are removed from the parsed info string", () => {
		const markdown = "```rust {#example}\nfn main() {}\n```";
		const unparsed = mdToHtml(markdown, {
			render: { fullInfoString: true },
		});
		const parsed = mdToHtml(markdown, {
			extension: { fencedCodeAttributes: true },
			render: { fullInfoString: true },
		});

		expect(unparsed).toContain('data-meta="{#example}"');
		expect(parsed).not.toContain("data-meta");
	});

	test("inline code attributes are parsed", () => {
		const html = mdToHtml("`const`{.typescript}", {
			extension: { inlineCodeAttributes: true },
		});
		expect(html).toBe("<p><code>const</code></p>\n");
	});

	test("link attributes are parsed", () => {
		const html = mdToHtml("[Comrak](https://github.com){rel=nofollow}", {
			extension: { linkAttributes: true },
		});
		expect(html).toContain('<a href="https://github.com">Comrak</a>');
		expect(html).not.toContain("rel=nofollow");
	});

	test("superscript", () => {
		expect(mdToHtml("x^2^", { extension: { superscript: true } })).toContain(
			"<sup>2</sup>",
		);
	});

	test("underline", () => {
		expect(
			mdToHtml("__underlined__", { extension: { underline: true } }),
		).toContain("<u>");
	});

	test("spoiler", () => {
		expect(mdToHtml("||hidden||", { extension: { spoiler: true } })).toContain(
			'<span class="spoiler"',
		);
	});

	test("header ids", () => {
		expect(mdToHtml("# Hello", { extension: { headerIds: "" } })).toContain(
			'id="hello"',
		);
	});

	test("header ids with prefix (deprecated headerIds)", () => {
		expect(mdToHtml("# Hello", { extension: { headerIds: "sec-" } })).toContain(
			'id="sec-hello"',
		);
	});

	test("headerIdPrefix (new name)", () => {
		expect(
			mdToHtml("# Hello", { extension: { headerIdPrefix: "sec-" } }),
		).toContain('id="sec-hello"');
	});

	test("headerIdPrefix uses Comrak 0.54 accessible anchor markup", () => {
		expect(mdToHtml("# Hello", { extension: { headerIdPrefix: "sec-" } })).toBe(
			'<h1 id="sec-hello">Hello<a href="#hello" ' +
				'aria-label="Link to heading \'Hello\'" data-heading-content="Hello" ' +
				'class="anchor"></a></h1>\n',
		);
	});

	test("headerIdPrefixInHref adds prefix to href", () => {
		const html = mdToHtml("# Hello", {
			extension: { headerIdPrefix: "sec-", headerIdPrefixInHref: true },
		});
		expect(html).toContain('id="sec-hello"');
		expect(html).toContain('href="#sec-hello"');
	});

	test("headerIdPrefixInHref false keeps href without prefix", () => {
		const html = mdToHtml("# Hello", {
			extension: { headerIdPrefix: "sec-", headerIdPrefixInHref: false },
		});
		expect(html).toContain('id="sec-hello"');
		expect(html).toContain('href="#hello"');
	});

	test("sourceposChars counts Unicode characters", () => {
		const byteColumns = mdToHtml("好", { render: { sourcepos: true } });
		const charColumns = mdToHtml("好", {
			parse: { sourceposChars: true },
			render: { sourcepos: true },
		});
		expect(byteColumns).toContain('data-sourcepos="1:1-1:3"');
		expect(charColumns).toContain('data-sourcepos="1:1-1:1"');
	});

	test("description lists", () => {
		const html = mdToHtml("Term\n\n: Definition", {
			extension: { descriptionLists: true },
		});
		expect(html).toContain("<dl>");
		expect(html).toContain("<dt>");
		expect(html).toContain("<dd>");
	});

	test("smart punctuation", () => {
		const html = mdToHtml('"Hello" -- world...', { parse: { smart: true } });
		expect(html).toContain("\u201C");
		expect(html).toContain("\u2013");
		expect(html).toContain("\u2026");
	});

	test("multiple extensions combined", () => {
		const md =
			"~~deleted~~ and https://example.com\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> [!WARNING]\n> Be careful";
		const html = mdToHtml(md, {
			extension: {
				strikethrough: true,
				table: true,
				tasklist: true,
				autolink: true,
				alerts: true,
			},
			render: { unsafe: true },
		});
		expect(html).toContain("<del>");
		expect(html).toContain("href=");
		expect(html).toContain("checkbox");
		expect(html).toContain("<table>");
		expect(html).toContain("markdown-alert-warning");
	});
});

// --- CommonMark ---

describe("commonmark", () => {
	test("roundtrip", () => {
		const md = "# Title\n\n- item 1\n- item 2\n";
		expect(mdToCommonmark(md, {})).toBe(md);
	});

	test("list style star", () => {
		expect(
			mdToCommonmark("- item\n", { render: { listStyle: "star" } }),
		).toContain("* item");
	});

	test("list style plus", () => {
		expect(
			mdToCommonmark("- item\n", { render: { listStyle: "plus" } }),
		).toContain("+ item");
	});

	test("escapes literal strikethrough delimiters", () => {
		expect(mdToCommonmark("~~text~~", {})).toBe("\\~\\~text\\~\\~\n");
	});

	test("preserves whitespace entities at emphasis boundaries", () => {
		expect(mdToCommonmark("**Hello&#32;**", {})).toBe("**Hello&#32;**\n");
	});

	test("formats malformed ordered lists in blockquotes without crashing", () => {
		expect(mdToCommonmark(">9)\r\u000b", {})).toBe("> 9) \n\n&#11;\n");
	});
});

// --- Syntax Highlighter ---

describe("syntax highlighter", () => {
	test("highlight callback invoked", () => {
		const sh = new SyntaxHighlighter(
			(code: string, lang: string) =>
				`<span class="hl" data-lang="${lang ?? ""}">${code}</span>`,
			() => "<pre>",
			() => "<code>",
		);
		const html = mdToHtmlWithPlugins(
			"```js\nconsole.log('hi')\n```",
			{ render: { unsafe: true } },
			sh,
		);
		expect(html).toContain('class="hl"');
		expect(html).toContain('data-lang="js"');
		expect(html).toContain("console.log");
	});

	test("custom pre and code tags", () => {
		const sh = new SyntaxHighlighter(
			(code: string) => code,
			() => '<pre class="custom-pre">',
			() => '<code class="custom-code">',
		);
		const html = mdToHtmlWithPlugins(
			"```\nhello\n```",
			{ render: { unsafe: true } },
			sh,
		);
		expect(html).toContain('class="custom-pre"');
		expect(html).toContain('class="custom-code"');
	});

	test("empty pre/code for highlighters that provide their own", () => {
		const sh = new SyntaxHighlighter(
			(code: string, lang: string) =>
				`<pre class="shiki"><code class="lang-${lang}">${code}</code></pre>`,
			() => "",
			() => "",
		);
		const html = mdToHtmlWithPlugins(
			"```rust\nfn main() {}\n```",
			{ render: { unsafe: true } },
			sh,
		);
		expect(html).toContain('class="shiki"');
		expect(html).toContain('class="lang-rust"');
	});

	test("lang is empty for an unspecified language", () => {
		let receivedLang: unknown = "not-called";
		const sh = new SyntaxHighlighter(
			(code: string, lang: string) => {
				receivedLang = lang;
				return code;
			},
			() => "<pre>",
			() => "<code>",
		);
		mdToHtmlWithPlugins("```\nno lang\n```", { render: { unsafe: true } }, sh);
		expect(receivedLang).toBe("");
	});

	test("null adapter falls back to default", () => {
		const html = mdToHtmlWithPlugins("```js\ncode\n```", {}, null, null);
		expect(html).toContain("<pre>");
		expect(html).toContain("<code");
	});

	test("works with extensions", () => {
		const sh = new SyntaxHighlighter(
			(code: string) => `<mark>${code}</mark>`,
			() => "<pre>",
			() => "<code>",
		);
		const html = mdToHtmlWithPlugins(
			"~~deleted~~\n\n```js\ncode\n```",
			{
				extension: { strikethrough: true },
				render: { unsafe: true },
			},
			sh,
		);
		expect(html).toContain("<del>deleted</del>");
		expect(html).toContain("<mark>code");
	});

	test("reuses one adapter across render calls", () => {
		const highlighter = new SyntaxHighlighter(
			(code: string) => `<mark>${code}</mark>`,
			() => "<pre>",
			() => "<code>",
		);

		const first = mdToHtmlWithPlugins("```js\none\n```", {}, highlighter);
		const second = mdToHtmlWithPlugins("```js\ntwo\n```", {}, highlighter);

		expect(first).toContain("<mark>one\n</mark>");
		expect(second).toContain("<mark>two\n</mark>");
	});

	test.each(invalidStringCallbacks)(
		"falls back safely when every callback $description",
		({ callback }) => {
			const highlighter = new SyntaxHighlighter(callback, callback, callback);

			expect(mdToHtmlWithPlugins("```js\n<tag>\n```", {}, highlighter)).toBe(
				'<pre><code class="language-js">&lt;tag&gt;\n</code></pre>\n',
			);
		},
	);

	test("Shiki adapter escapes code when highlighting fails", () => {
		const failingShiki: ShikiHighlighter = {
			codeToHtml() {
				throw new Error("unknown language");
			},
		};
		const adapter = createShikiAdapter(SyntaxHighlighter, failingShiki, {
			name: "github-dark",
			bg: "#24292e",
			fg: "#e1e4e8",
		});
		const html = mdToHtmlWithPlugins(
			"```unknown\n</code><img src=x onerror=alert(1)>\n```",
			{},
			adapter,
		);

		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;/code&gt;&lt;img src=x onerror=alert(1)&gt;");
	});

	test("Shiki adapter preserves Comrak formatter attributes", () => {
		const shiki: ShikiHighlighter = {
			codeToHtml(code) {
				return `<pre><code><span>${code}</span></code></pre>`;
			},
		};
		const adapter = createShikiAdapter(SyntaxHighlighter, shiki, {
			name: "github-dark",
			bg: "#24292e",
			fg: "#e1e4e8",
		});
		const html = mdToHtmlWithPlugins(
			"```js metadata\nconst x = 1;\n```",
			{
				render: {
					fullInfoString: true,
					githubPreLang: true,
					sourcepos: true,
				},
			},
			adapter,
		);

		expect(html).toMatch(/<pre[^>]*lang="js"/);
		expect(html).toMatch(/<pre[^>]*data-meta="metadata"/);
		expect(html).toMatch(/<pre[^>]*data-sourcepos=/);
	});
});

// --- Heading Adapter ---

describe("heading adapter", () => {
	test("custom heading tags", () => {
		const ha = new HeadingAdapter(
			(heading: HeadingMeta) =>
				`<h${heading.level} class="custom" data-text="${heading.content}">`,
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);
		const html = mdToHtmlWithPlugins(
			"# Hello World",
			{ render: { unsafe: true } },
			null,
			ha,
		);
		expect(html).toContain('class="custom"');
		expect(html).toContain('data-text="Hello World"');
	});

	test("receives correct level", () => {
		const levels: number[] = [];
		const ha = new HeadingAdapter(
			(heading: HeadingMeta) => {
				levels.push(heading.level);
				return `<h${heading.level}>`;
			},
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);
		mdToHtmlWithPlugins(
			"# H1\n\n## H2\n\n### H3",
			{ render: { unsafe: true } },
			null,
			ha,
		);
		expect(levels).toEqual([1, 2, 3]);
	});

	test("both adapters together", () => {
		const sh = new SyntaxHighlighter(
			(code: string) => `<em>${code}</em>`,
			() => "<pre>",
			() => "<code>",
		);
		const ha = new HeadingAdapter(
			(heading: HeadingMeta) => `<h${heading.level} id="custom">`,
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);
		const html = mdToHtmlWithPlugins(
			"# Title\n\n```js\ncode\n```",
			{ render: { unsafe: true } },
			sh,
			ha,
		);
		expect(html).toContain('id="custom"');
		expect(html).toContain("<em>code");
	});

	test("reuses one adapter across render calls", () => {
		const adapter = new HeadingAdapter(
			(heading: HeadingMeta) => `<h${heading.level} class="reused">`,
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);

		const first = mdToHtmlWithPlugins("# One", {}, null, adapter);
		const second = mdToHtmlWithPlugins("## Two", {}, null, adapter);

		expect(first).toBe('<h1 class="reused">One</h1>');
		expect(second).toBe('<h2 class="reused">Two</h2>');
	});

	test.each(invalidStringCallbacks)(
		"falls back safely when both callbacks $description",
		({ callback }) => {
			const adapter = new HeadingAdapter(callback, callback);

			expect(mdToHtmlWithPlugins("# Hello", {}, null, adapter)).toBe(
				"<h1>Hello</h1>",
			);
		},
	);
});

// --- XML ---

describe("xml", () => {
	test("basic markdown", () => {
		const xml = mdToXml("# Hello\n\nworld", {});
		expect(xml).toContain("<?xml");
		expect(xml).toContain("<heading");
		expect(xml).toContain("Hello");
	});

	test("code block", () => {
		expect(mdToXml("```js\ncode\n```", {})).toContain("<code_block");
	});

	test("empty input", () => {
		expect(mdToXml("", {})).toContain("<?xml");
	});

	test("deprecated plugin alias leaves adapters reusable", () => {
		const ha = new HeadingAdapter(
			(heading: HeadingMeta) => `<h${heading.level} class="reused">`,
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);
		const xml = mdToXmlWithPlugins("# Hello", {}, null, ha);
		expect(xml).toContain("<?xml");
		expect(xml).toContain("Hello");
		expect(mdToHtmlWithPlugins("# Still reusable", {}, null, ha)).toContain(
			'class="reused"',
		);
	});
});

// --- Codefence Renderer ---

describe("codefence renderer", () => {
	test("custom renderer for specific language", () => {
		const html = mdToHtmlWithCodefenceRenderers(
			"```mermaid\ngraph TD\nA --> B\n```",
			{ render: { unsafe: true } },
			{
				mermaid: (lang: string, _meta: string, code: string) =>
					`<div class="mermaid" data-lang="${lang}">${code}</div>`,
			},
		);
		expect(html).toContain('class="mermaid"');
		expect(html).toContain("graph TD");
	});

	test("non-matching language uses default", () => {
		const html = mdToHtmlWithCodefenceRenderers(
			"```js\ncode\n```",
			{},
			{
				mermaid: (_l: string, _m: string, c: string) =>
					`<div class="mermaid">${c}</div>`,
			},
		);
		expect(html).toContain("<pre>");
	});

	test("multiple languages", () => {
		const html = mdToHtmlWithCodefenceRenderers(
			"```mermaid\ngraph\n```\n\n```katex\nx^2\n```",
			{ render: { unsafe: true } },
			{
				mermaid: (_l: string, _m: string, c: string) =>
					`<div class="mermaid">${c}</div>`,
				katex: (_l: string, _m: string, c: string) =>
					`<span class="katex">${c}</span>`,
			},
		);
		expect(html).toContain('class="mermaid"');
		expect(html).toContain('class="katex"');
	});

	test("null renderers falls back to default", () => {
		const html = mdToHtmlWithCodefenceRenderers("```js\ncode\n```", {}, null);
		expect(html).toContain("<pre>");
	});

	test("with syntax highlighter", () => {
		const sh = new SyntaxHighlighter(
			(code: string) => `<em>${code}</em>`,
			() => "<pre>",
			() => "<code>",
		);
		const html = mdToHtmlWithCodefenceRenderers(
			"```mermaid\ngraph\n```\n\n```js\ncode\n```",
			{ render: { unsafe: true } },
			{
				mermaid: (_l: string, _m: string, c: string) =>
					`<div class="mermaid">${c}</div>`,
			},
			sh,
		);
		expect(html).toContain('class="mermaid"');
		expect(html).toContain("<em>code");
	});

	test("reuses one renderer map across render calls", () => {
		const renderers = {
			mermaid: (lang: string, _meta: string, code: string) =>
				`<figure data-lang="${lang}">${code}</figure>`,
		};

		const first = mdToHtmlWithCodefenceRenderers(
			"```mermaid\nfirst\n```",
			{},
			renderers,
		);
		const second = mdToHtmlWithCodefenceRenderers(
			"```mermaid\nsecond\n```",
			{},
			renderers,
		);

		expect(first).toContain('<figure data-lang="mermaid">first\n</figure>');
		expect(second).toContain('<figure data-lang="mermaid">second\n</figure>');
	});

	test("reuses one syntax adapter across codefence renderer calls", () => {
		const highlighter = new SyntaxHighlighter(
			(code: string) => `<mark>${code}</mark>`,
			() => "<pre>",
			() => "<code>",
		);

		const first = mdToHtmlWithCodefenceRenderers(
			"```js\nfirst\n```",
			{},
			{},
			highlighter,
		);
		const second = mdToHtmlWithCodefenceRenderers(
			"```js\nsecond\n```",
			{},
			{},
			highlighter,
		);

		expect(first).toContain("<mark>first\n</mark>");
		expect(second).toContain("<mark>second\n</mark>");
	});

	test.each(invalidStringCallbacks)(
		"falls back safely when the renderer callback $description",
		({ callback }) => {
			expect(
				mdToHtmlWithCodefenceRenderers(
					"```js\n<tag>\n```",
					{},
					{
						js: callback,
					},
				),
			).toBe('<pre><code class="language-js">&lt;tag&gt;\n</code></pre>\n');
		},
	);

	test("rejects malformed renderer registrations", () => {
		const renderUnchecked = mdToHtmlWithCodefenceRenderers as unknown as (
			markdown: string,
			options: unknown,
			renderers: unknown,
		) => string;

		expect(() => renderUnchecked("```js\ncode\n```", {}, 42)).toThrow(
			/codefence renderers must be an object/,
		);
		expect(() =>
			renderUnchecked("```js\ncode\n```", {}, { js: "not a function" }),
		).toThrow(/codefence renderer for "js" must be a Function/);
	});
});

// --- URL Rewriter ---

describe("url rewriter", () => {
	test("rewrite image URLs", () => {
		const html = mdToHtmlWithRewriters(
			"![alt](http://example.com/img.png)",
			{ render: { unsafe: true } },
			(url: string) => `https://proxy/${url}`,
			null,
		);
		expect(html).toContain("https://proxy/http://example.com/img.png");
	});

	test("rewrite link URLs", () => {
		const html = mdToHtmlWithRewriters(
			"[click](http://example.com)",
			{ render: { unsafe: true } },
			null,
			(url: string) => `https://redir/${url}`,
		);
		expect(html).toContain("https://redir/http://example.com");
	});

	test("both rewriters", () => {
		const html = mdToHtmlWithRewriters(
			"![img](http://img.com/a.png)\n\n[link](http://link.com)",
			{ render: { unsafe: true } },
			(url: string) => `https://img-proxy/${url}`,
			(url: string) => `https://link-proxy/${url}`,
		);
		expect(html).toContain("https://img-proxy/http://img.com/a.png");
		expect(html).toContain("https://link-proxy/http://link.com");
	});

	test("null rewriters leave URLs unchanged", () => {
		const html = mdToHtmlWithRewriters(
			"![img](http://example.com/img.png)\n\n[link](http://example.com)",
			{ render: { unsafe: true } },
			null,
			null,
		);
		expect(html).toContain('src="http://example.com/img.png"');
		expect(html).toContain('href="http://example.com"');
	});

	test.each(invalidStringCallbacks)(
		"keeps original URLs when callbacks $description",
		({ callback }) => {
			const html = mdToHtmlWithRewriters(
				"![image](https://example.com/image.png)\n\n[link](https://example.com)",
				{},
				callback,
				callback,
			);

			expect(html).toContain('src="https://example.com/image.png"');
			expect(html).toContain('href="https://example.com"');
		},
	);

	test("rejects malformed URL rewriters", () => {
		const renderUnchecked = mdToHtmlWithRewriters as unknown as (
			markdown: string,
			options: unknown,
			imageRewriter: unknown,
			linkRewriter: unknown,
		) => string;

		expect(() => renderUnchecked("![alt](image.png)", {}, 42, null)).toThrow(
			/image URL rewriter must be a Function/,
		);
		expect(() => renderUnchecked("[link](url)", {}, null, {})).toThrow(
			/link URL rewriter must be a Function/,
		);
	});
});

describe("rewriters and plugins combined", () => {
	const source =
		"![img](http://img.com/a.png)\n\n[link](http://link.com)\n\n```js\ncode\n```\n\n```mermaid\ngraph TD\n```";

	test("rewriters, highlighter and codefence renderers compose in one render", () => {
		const sh = new SyntaxHighlighter(
			(code: string, lang: string) =>
				`<span class="hl" data-lang="${lang ?? ""}">${code}</span>`,
			() => "<pre>",
			() => "<code>",
		);
		const html = mdToHtmlWithRewritersAndPlugins(
			source,
			{ render: { unsafe: true } },
			(url: string) => `https://img-proxy/${url}`,
			(url: string) => `https://link-proxy/${url}`,
			sh,
			null,
			{
				mermaid: (lang: string, _meta: string, code: string) =>
					`<div class="diagram" data-lang="${lang}">${code.trim()}</div>`,
			},
		);
		expect(html).toContain("https://img-proxy/http://img.com/a.png");
		expect(html).toContain("https://link-proxy/http://link.com");
		expect(html).toContain('class="hl"');
		expect(html).toContain('data-lang="js"');
		expect(html).toContain(
			'<div class="diagram" data-lang="mermaid">graph TD</div>',
		);
	});

	test("all-null extras render like the plain rewriter entry", () => {
		expect(
			mdToHtmlWithRewritersAndPlugins(
				source,
				{ render: { unsafe: true } },
				null,
				null,
				null,
				null,
				null,
			),
		).toBe(
			mdToHtmlWithRewriters(source, { render: { unsafe: true } }, null, null),
		);
	});

	test("rejects malformed URL rewriters like the plain entry", () => {
		const renderUnchecked = mdToHtmlWithRewritersAndPlugins as unknown as (
			markdown: string,
			options: unknown,
			imageRewriter: unknown,
			linkRewriter: unknown,
		) => string;
		expect(() => renderUnchecked("![alt](image.png)", {}, 42, null)).toThrow(
			/image URL rewriter must be a Function/,
		);
	});
});

// --- Text Output ---

describe("text", () => {
	test("rejects table shadows that are not one safe character", () => {
		expect(() =>
			mdToText("| a |\n|---|\n| b |", {}, false, false, "ab"),
		).toThrowError(
			"tableShadow must be empty or one non-control Unicode scalar value",
		);
	});

	test("bounds padding for highly skewed tables without truncating content", () => {
		const wide = "x".repeat(1_024);
		const rows = Array.from({ length: 1_024 }, () => "| a |").join("\n");
		const text = mdToText(
			`| ${wide} |\n|---|\n${rows}`,
			{ extension: { table: true } },
			false,
			false,
			"",
		);

		expect(text).toContain(wide);
		expect(text.length).toBeLessThan(400_000);
	});

	// --- Headings (showMarkdown=false by default) ---
	test("H1 no # prefix by default", () => {
		expect(mdToText("# Title", {})).toBe("Title");
	});

	test("H2 no ## prefix by default", () => {
		expect(mdToText("## Subtitle", {})).toBe("Subtitle");
	});

	test("H1 shows # with showMarkdown=true", () => {
		expect(mdToText("# Title", {}, false, true)).toBe("# Title");
	});

	test("H3 always shows ### prefix", () => {
		expect(mdToText("### Section", {})).toBe("### Section");
	});

	// --- Inline formatting ---
	test("bold stripped in text", () => {
		expect(mdToText("**bold**", {})).toBe("bold");
	});

	test("italic stripped in text", () => {
		expect(mdToText("*italic*", {})).toBe("italic");
	});

	test("strikethrough stripped in text", () => {
		expect(mdToText("~~struck~~", { extension: { strikethrough: true } })).toBe(
			"struck",
		);
	});

	test("nested bold+italic stripped", () => {
		expect(mdToText("**bold *and italic***", {})).toBe("bold and italic");
	});

	test("inline code no backticks by default", () => {
		expect(mdToText("use `const`", {})).toBe("use const");
	});

	test("inline code shows backticks with showMarkdown=true", () => {
		expect(mdToText("use `const`", {}, false, true)).toBe("use `const`");
	});

	// --- Code blocks ---
	test("code block no fences by default", () => {
		const text = mdToText("```js\ncode\n```", {});
		expect(text).not.toContain("```");
		expect(text).toContain("code");
	});

	test("code block shows fences with showMarkdown=true", () => {
		const text = mdToText("```js\ncode\n```", {}, false, true);
		expect(text).toContain("```js");
	});

	// --- Lists ---
	test("unordered list always shows bullets", () => {
		const text = mdToText("- one\n- two", {});
		expect(text).toContain("• one");
		expect(text).toContain("• two");
	});

	test("ordered list always shows numbers", () => {
		const text = mdToText("1. first\n2. second", {});
		expect(text).toContain("1. first");
		expect(text).toContain("2. second");
	});

	test("code block inside list item has blank line before and after", () => {
		const text = mdToText(
			"- Item one\n\n        code inside\n\n- Item two",
			{},
		);
		// Blank line before code block
		expect(text).toMatch(/Item one\n\n/);
		// Blank line after code block
		expect(text).toMatch(/code inside\n\n/);
		expect(text).toContain("• Item two");
	});

	test("simple list has no extra spacing", () => {
		const text = mdToText("- one\n- two\n- three", {});
		expect(text).toBe("• one\n• two\n• three");
	});

	test("code block inside nested list item has blank line before and after", () => {
		const text = mdToText(
			"- Item\n    - Sub-item\n\n            nested_code()\n\n- Next",
			{},
		);
		// Blank line before code block
		expect(text).toMatch(/Sub-item\n\n/);
		// Blank line after code block
		expect(text).toMatch(/nested_code\(\)\n\n/);
		expect(text).toContain("• Next");
	});

	test("text and ansi match for list with code block", () => {
		const md = "- Item one\n\n        code inside\n\n- Item two\n- Item three";
		const text = mdToText(md, {});
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes for text comparison
		const ansi = mdToAnsi(md, {}).replace(/\x1b\[[0-9;]*m/g, "");
		expect(ansi).toBe(text);
	});

	test("text and ansi match for nested list with code block", () => {
		const md = "- Item\n    - Sub-item\n\n            nested_code()\n\n- Next";
		const text = mdToText(md, {});
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes for text comparison
		const ansi = mdToAnsi(md, {}).replace(/\x1b\[[0-9;]*m/g, "");
		expect(ansi).toBe(text);
	});

	test("task list uses symbols by default", () => {
		expect(mdToText("- [x] done", { extension: { tasklist: true } })).toContain(
			"☒ done",
		);
	});

	test("task list shows markers with showMarkdown=true", () => {
		expect(
			mdToText("- [x] done", { extension: { tasklist: true } }, false, true),
		).toContain("- [x] done");
	});

	// --- Blockquotes ---
	test("blockquote uses │ prefix", () => {
		const text = mdToText("> quoted", {});
		expect(text).toContain("│");
		expect(text).toContain("quoted");
	});

	test("blockquote prefix always shown with showMarkdown=false", () => {
		const text = mdToText("> quoted", {}, false, false);
		expect(text).toContain("│");
	});

	// --- Thematic break ---
	test("thematic break uses box drawing", () => {
		expect(mdToText("---", {})).toContain("────");
	});

	// --- Tables ---
	test("table with box drawing", () => {
		const text = mdToText("| a | b |\n|---|---|\n| 1 | 2 |", {
			extension: { table: true },
		});
		expect(text).toContain("┌");
		expect(text).toContain("│");
		expect(text).toContain("┘");
	});

	test("table columns use terminal width for CJK and combining characters", () => {
		const markdown = "| a | b |\n|---|---|\n| 好好 | 1 |\n| é | 2 |";

		expect(
			mdToText(markdown, { extension: { table: true } }, false, false, ""),
		).toBe(`┌──────┬─────┐
│ a    │ b   │
├──────┼─────┤
│ 好好 │ 1   │
│ é    │ 2   │
└──────┴─────┘`);
	});

	test("table columns count emoji sequences as two terminal cells", () => {
		const markdown = "| a | b |\n|---|---|\n| 👩‍💻 | 👨‍👩‍👧‍👦 |\n| 🇭🇺 | ❤️ |";
		const [topBorder] = mdToText(
			markdown,
			{ extension: { table: true } },
			false,
			false,
			"",
		).split("\n");

		expect(topBorder).toBe("┌─────┬─────┐");
	});

	test("preserves literal escaped-tag containers", () => {
		expect(
			mdToText("~~foo~~ and |bar|", {
				extension: { spoiler: true, subscript: true },
			}),
		).toBe("~~foo~~ and |bar|");
	});

	test.each([
		{
			markdown: "[[/guides/comrak|Comrak guide]]",
			options: { wikilinksTitleAfterPipe: true },
		},
		{
			markdown: "[[Comrak guide|/guides/comrak]]",
			options: { wikilinksTitleBeforePipe: true },
		},
	])(
		"preserves wikilink titles for both pipe orders",
		({ markdown, options }) => {
			expect(mdToText(markdown, { extension: options })).toBe("Comrak guide");
			expect(mdToText(markdown, { extension: options }, true)).toBe(
				"Comrak guide (/guides/comrak)",
			);
		},
	);

	// --- Links ---
	test("links hide URLs by default", () => {
		expect(mdToText("[click](https://example.com)", {})).toBe("click");
	});

	test("links show URLs with showUrls=true", () => {
		expect(mdToText("[click](https://example.com)", {}, true)).toBe(
			"click (https://example.com)",
		);
	});

	// --- Empty ---
	test("empty input", () => {
		expect(mdToText("", {})).toBe("");
	});
});

// --- ANSI Output (structural tests only, no color assertions) ---

describe("ansi", () => {
	test("rejects table shadows that are not one safe character", () => {
		expect(() =>
			mdToAnsi(
				"| a |\n|---|\n| b |",
				{ extension: { table: true } },
				{
					tableShadow: "\x1b",
				},
			),
		).toThrowError(
			"tableShadow must be empty or one non-control Unicode scalar value",
		);
	});

	test("strips terminal control sequences from Markdown literals", () => {
		expect(mdToAnsi("safe\x1b]52;c;SGVsbG8=\x07tail\u009b31m", {})).toBe(
			"safe]52;c;SGVsbG8=tail31m",
		);
	});

	// --- Headings (showMarkdown=false by default) ---
	test("H1 no # prefix by default", () => {
		expect(mdToAnsi("# Heading", {})).not.toContain("# ");
	});

	test("H1 shows # with showMarkdown=true", () => {
		expect(mdToAnsi("# Heading", {}, { showMarkdown: true })).toContain(
			"# Heading",
		);
	});

	test("H3 always shows ### prefix", () => {
		expect(mdToAnsi("### Section", {})).toContain("### Section");
	});

	// --- Inline formatting (no markers by default) ---
	test("bold no ** markers by default", () => {
		const ansi = mdToAnsi("**bold**", {});
		expect(ansi).not.toContain("**");
		expect(ansi).toContain("bold");
	});

	test("bold shows ** with showMarkdown=true", () => {
		expect(mdToAnsi("**bold**", {}, { showMarkdown: true })).toContain(
			"**bold**",
		);
	});

	test("inline code no backticks by default", () => {
		const ansi = mdToAnsi("use `const`", {});
		expect(ansi).not.toContain("`");
		expect(ansi).toContain("const");
	});

	// --- Code blocks ---
	test("code block no fences by default", () => {
		const ansi = mdToAnsi("```js\ncode\n```", {});
		expect(ansi).not.toContain("```");
		expect(ansi).toContain("code");
	});

	test("code block shows fences with showMarkdown=true", () => {
		expect(mdToAnsi("```js\ncode\n```", {}, { showMarkdown: true })).toContain(
			"```js",
		);
	});

	// --- Lists ---
	test("unordered list always shows bullet", () => {
		const ansi = mdToAnsi("- item", {});
		expect(ansi).toContain("•");
		expect(ansi).toContain("item");
	});

	test("ordered numbers always shown", () => {
		const ansi = mdToAnsi("1. first\n2. second", {});
		expect(ansi).toContain("1.");
		expect(ansi).toContain("2.");
	});

	test("blockquote uses │ prefix", () => {
		expect(mdToAnsi("> quoted", {})).toContain("│");
	});

	test("blockquote prefix always shown with showMarkdown=false", () => {
		expect(mdToAnsi("> quoted", {}, { showMarkdown: false })).toContain("│");
	});

	test("link shows text and URL", () => {
		const ansi = mdToAnsi("[click](https://example.com)", {});
		expect(ansi).toContain("click");
		expect(ansi).toContain("https://example.com");
	});

	test("link hides URL with showUrls=false", () => {
		const ansi = mdToAnsi("[click](https://x)", {}, { showUrls: false });
		expect(ansi).toContain("click");
		expect(ansi).not.toContain("https://x");
	});

	test("thematic break shows box drawing", () => {
		expect(mdToAnsi("---", {})).toContain("────");
	});

	test("table with box drawing", () => {
		const ansi = mdToAnsi("| a | b |\n|---|---|\n| 1 | 2 |", {
			extension: { table: true },
		});
		expect(ansi).toContain("┌");
		expect(ansi).toContain("│");
		expect(ansi).toContain("┘");
	});

	test("OSC hyperlink URLs containing m do not affect table width", () => {
		const ansi = mdToAnsi(
			"| link | x |\n|---|---|\n| [go](https://example.com/more) | y |",
			{ extension: { table: true } },
			{ hyperlinks: true, showUrls: false, tableShadow: "" },
		);

		expect(ansi).toContain("\x1b]8;;https://example.com/more\x1b\\");
		expect(ansi).toContain("┌──────┬─────┐");

		const renderLinkedTable = (url: string) =>
			mdToAnsi(
				`| link | x |\n|---|---|\n| [go](${url}) | y |`,
				{ extension: { table: true } },
				{ hyperlinks: true, showUrls: false, tableShadow: "" },
			);
		const withoutTerminatorLetter = renderLinkedTable(
			`https://example.com/${"x".repeat(256)}`,
		);
		const withTerminatorLetter = renderLinkedTable(
			`https://example.com/${"m".repeat(256)}`,
		);
		expect(withTerminatorLetter.length).toBe(withoutTerminatorLetter.length);
	});

	test("plain text has no escape codes", () => {
		expect(mdToAnsi("just text", {})).not.toContain("\x1b[");
	});

	test("empty input", () => {
		expect(mdToAnsi("", {})).toBe("");
	});

	test("styled content has escape codes", () => {
		expect(mdToAnsi("**bold**", {})).toContain("\x1b[");
	});

	test("custom theme overrides defaults", () => {
		expect(
			mdToAnsi("**bold**", {}, { bold: "\x1b[1;31m", reset: "\x1b[0m" }),
		).toContain("\x1b[1;31m");
	});

	test("empty string theme disables style", () => {
		const ansi = mdToAnsi("**bold**", {}, { bold: "", reset: "" });
		expect(ansi).not.toContain("\x1b[");
		expect(ansi).toContain("bold");
	});

	test("rejects malformed ANSI themes", () => {
		const renderWithUncheckedTheme = mdToAnsi as unknown as (
			markdown: string,
			options: unknown,
			theme: unknown,
		) => string;

		expect(() => renderWithUncheckedTheme("hello", {}, { bold: 42 })).toThrow(
			/invalid ANSI theme/,
		);
	});

	test("dark, light, and automatic themes use exact palette values", () => {
		expect(ansiThemeDark().heading).toBe("\x1b[1;34m");
		expect(ansiThemeDark().code).toBe("\x1b[48;5;236m\x1b[38;5;215m");
		expect(ansiThemeLight().heading).toBe("\x1b[1;34m");
		expect(ansiThemeLight().code).toBe("\x1b[48;5;254m\x1b[38;5;124m");
		expect(detectColorScheme("0;15")).toBe("light");
		expect(detectColorScheme("15;0")).toBe("dark");
		expect(ansiThemeAuto("0;15")).toEqual(ansiThemeLight());
		expect(ansiThemeAuto("15;0")).toEqual(ansiThemeDark());
	});
});

// --- Walker Limits ---

describe("walker limits", () => {
	test.each([
		{ name: "text", render: (markdown: string) => mdToText(markdown, {}) },
		{ name: "ANSI", render: (markdown: string) => mdToAnsi(markdown, {}) },
	])(
		"$name output rejects excessive nesting with a RangeError",
		({ render }) => {
			const markdown = `${"> ".repeat(600)}deep`;
			const renderDeeplyNestedMarkdown = () => render(markdown);

			expect(renderDeeplyNestedMarkdown).toThrow(RangeError);
			expect(renderDeeplyNestedMarkdown).toThrow(
				"markdown nesting exceeds the text/ANSI limit of 512",
			);
		},
	);
});

// --- Heal Markdown ---

describe("heal", () => {
	test("property: healing is idempotent", () => {
		const markdownFragment = fc.constantFrom(
			"plain",
			" ",
			"\n",
			"*",
			"**",
			"_",
			"__",
			"~",
			"~~",
			"`",
			"```",
			"$",
			"$$",
			"[",
			"]",
			"(",
			")",
			"<",
			">",
			"\\",
			"\u200B",
			"好",
			"🌍",
		);
		const markdown = fc
			.array(markdownFragment, { maxLength: 64 })
			.map((fragments) => fragments.join(""));

		fc.assert(
			fc.property(markdown, (input) => {
				const healed = healMarkdown(input);

				expect(healMarkdown(healed)).toBe(healed);
			}),
			{ numRuns: 500, seed: 49_316 },
		);
	});

	test("property: exposed HTML suffixes reach a fixed point in one call", () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 64 }), (tagCount) => {
				const healed = healMarkdown(`start${"<a".repeat(tagCount)}`);

				expect(healed).toBe("start");
				expect(healMarkdown(healed)).toBe(healed);
			}),
			{ numRuns: 100, seed: 71_420_026 },
		);
	});

	test("closes unclosed bold", () => {
		expect(healMarkdown("**bold")).toBe("**bold**");
	});

	test("closes unclosed italic *", () => {
		expect(healMarkdown("*italic")).toBe("*italic*");
	});

	test("closes unclosed italic _", () => {
		expect(healMarkdown("_italic")).toBe("_italic_");
	});

	test("closes unclosed bold-italic", () => {
		expect(healMarkdown("***bold italic")).toBe("***bold italic***");
	});

	test("closes unclosed inline code", () => {
		expect(healMarkdown("use `const")).toBe("use `const`");
	});

	test("leaves complete triple-backtick inline code unchanged", () => {
		expect(healMarkdown("```test```")).toBe("```test```");
	});

	test("closes unclosed code block", () => {
		const result = healMarkdown("```js\ncode");
		expect(result).toContain("```js\ncode");
		expect(result.endsWith("\n```")).toBe(true);
	});

	test("closes unclosed strikethrough", () => {
		expect(healMarkdown("~~deleted")).toBe("~~deleted~~");
	});

	test("closes unclosed block katex", () => {
		const result = healMarkdown("$$\nx^2");
		expect(result).toContain("$$");
		expect(result.match(/\$\$/g)?.length).toBe(2);
	});

	test("closes unclosed link URL", () => {
		expect(healMarkdown("[click](https://example.com")).toBe(
			"[click](https://example.com)",
		);
	});

	test("strips incomplete link text", () => {
		expect(healMarkdown("text [incomplete")).toBe("text incomplete");
	});

	test("closes unclosed __ italic", () => {
		expect(healMarkdown("__underline")).toBe("__underline__");
	});

	test("half-closed bold appends single *", () => {
		expect(healMarkdown("**bold*")).toBe("**bold**");
	});

	test("half-closed strikethrough appends single ~", () => {
		expect(healMarkdown("~~strike~")).toBe("~~strike~~");
	});

	test("strips incomplete HTML tag", () => {
		expect(healMarkdown("text <div")).toBe("text");
	});

	test("prevents setext heading with single dash", () => {
		const result = healMarkdown("title\n-");
		expect(result).not.toBe("title\n-");
		expect(result).toContain("title");
	});

	test("does not modify complete markdown", () => {
		const md = "# Hello\n\n**bold** and *italic*\n\n```js\ncode\n```";
		expect(healMarkdown(md)).toBe(md);
	});

	test("does not modify empty input", () => {
		expect(healMarkdown("")).toBe("");
	});

	test("does not heal inside code blocks", () => {
		expect(healMarkdown("```\n**unclosed\n```")).toBe("```\n**unclosed\n```");
	});

	test("handles escaped delimiters", () => {
		expect(healMarkdown("\\*not italic")).toBe("\\*not italic");
	});

	test("strips trailing single space", () => {
		expect(healMarkdown("text ")).toBe("text");
	});

	test("preserves double trailing space", () => {
		expect(healMarkdown("text  ")).toBe("text  ");
	});

	test("healed markdown renders correctly", () => {
		const healed = healMarkdown("**bold");
		const html = mdToHtml(healed, {});
		expect(html).toContain("<strong>bold</strong>");
	});

	test("handles ZWSP (U+200B) without crashing", () => {
		expect(healMarkdown("Text\u200Bwith\u200BZWSP")).toBe(
			"Text\u200Bwith\u200BZWSP",
		);
	});

	test("handles ZWSP with unclosed bold", () => {
		expect(healMarkdown("**bold\u200Btext")).toBe("**bold\u200Btext**");
	});

	test("handles ZWSP with unclosed link", () => {
		expect(healMarkdown("[link\u200Btext](url")).toBe("[link\u200Btext](url)");
	});

	test("handles emoji without crashing", () => {
		expect(healMarkdown("Hello 🌍 world")).toBe("Hello 🌍 world");
	});

	test("handles CJK characters with unclosed code", () => {
		expect(healMarkdown("`代码")).toBe("`代码`");
	});
});

// --- Frontmatter ---

describe("frontmatter", () => {
	const opts = { extension: { frontMatterDelimiter: "---" } };

	test("extracts YAML frontmatter", () => {
		const md = "---\ntitle: Hello\ndate: 2026-01-01\n---\n\n# Content";
		expect(getFrontmatter(md, opts)).toBe("title: Hello\ndate: 2026-01-01");
	});

	test("extracts CRLF frontmatter without leaking carriage returns", () => {
		const md =
			"---\r\ntitle: Hello\r\ndate: 2026-01-01\r\n---\r\n\r\n# Content";

		expect(getFrontmatter(md, opts)).toBe("title: Hello\r\ndate: 2026-01-01");
	});

	test("returns undefined when no frontmatter", () => {
		expect(getFrontmatter("# No frontmatter", opts)).toBeUndefined();
	});

	test("returns undefined for empty frontmatter", () => {
		expect(getFrontmatter("---\n---\n\n# Empty", opts)).toBeUndefined();
	});

	test("returns undefined without delimiter option", () => {
		expect(
			getFrontmatter("---\ntitle: Hello\n---\n\n# Content", {}),
		).toBeUndefined();
	});

	test("handles multiline YAML", () => {
		const md = "---\ntitle: Hello\ntags:\n  - rust\n  - wasm\n---\n\n# Content";
		const fm = getFrontmatter(md, opts);
		expect(fm).toContain("title: Hello");
		expect(fm).toContain("  - rust");
		expect(fm).toContain("  - wasm");
	});
});

// --- Memory ---

describe("memory", () => {
	const md = [
		"# Heading",
		"",
		"**bold** *italic* `code` ~~strike~~",
		"",
		"| a | b |",
		"|---|---|",
		"| 1 | 2 |",
		"",
		"> blockquote",
		"",
		"- [x] task",
		"- item",
		"",
		"```js",
		"code block",
		"```",
		"",
		"[link](http://example.com)",
		"",
		"---",
	].join("\n");

	const opts = {
		extension: {
			strikethrough: true,
			table: true,
			tasklist: true,
			autolink: true,
			alerts: true,
		},
		render: { unsafe: true },
	};

	function getWasmPages(): number {
		return wasmMemory.buffer.byteLength / 65536;
	}

	// Asserts the WASM heap grows by at most one 64 KiB page across 1000 calls.
	function expectBoundedWasmGrowth(fn: () => void): void {
		for (let i = 0; i < 10; i++) fn(); // warm up
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) fn();
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	}

	test("mdToHtml keeps Wasm high-water growth bounded", () => {
		expectBoundedWasmGrowth(() => mdToHtml(md, opts));
	});

	test("mdToText keeps Wasm high-water growth bounded", () => {
		expectBoundedWasmGrowth(() => mdToText(md, opts));
	});

	test("mdToAnsi keeps Wasm high-water growth bounded", () => {
		expectBoundedWasmGrowth(() => mdToAnsi(md, opts));
	});

	test("healMarkdown keeps Wasm high-water growth bounded", () => {
		const incomplete = "**bold\n```js\ncode\n~~strike";
		expectBoundedWasmGrowth(() => healMarkdown(incomplete));
	});

	test("plugin rendering keeps Wasm high-water growth bounded", () => {
		expectBoundedWasmGrowth(() => {
			const sh = new SyntaxHighlighter(
				(code: string) => code,
				() => "<pre>",
				() => "<code>",
			);
			mdToHtmlWithPlugins(md, opts, sh);
		});
	});
});
