import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, test } from "vitest";
import {
	ansiThemeDark,
	ansiThemeLight,
	comrakVersion,
	getFrontmatter,
	HeadingAdapter,
	healMarkdown,
	initSync,
	mdToAnsi,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithCodefenceRenderers,
	mdToHtmlWithPlugins,
	mdToHtmlWithRewriters,
	mdToText,
	mdToXml,
	mdToXmlWithPlugins,
	SyntaxHighlighter,
} from "./pkg/comrak.js";

type HeadingMeta = { level: number; content: string };

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
	test("comrakVersion returns semver string", () => {
		expect(comrakVersion()).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("empty input", () => {
		expect(mdToHtml("", {})).toBe("");
	});

	test("empty input commonmark", () => {
		expect(mdToCommonmark("", {})).toBe("");
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
		expect(
			mdToHtml("Text[^1]\n\n[^1]: Footnote content", {
				extension: { footnotes: true },
			}),
		).toContain("footnote");
	});

	test("alerts", () => {
		const html = mdToHtml("> [!NOTE]\n> Important info", {
			extension: { alerts: true },
		});
		expect(html).toContain("markdown-alert");
		expect(html).toContain("markdown-alert-note");
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
});

// --- Syntax Highlighter ---

describe("syntax highlighter", () => {
	test("highlight callback invoked", () => {
		const sh = new SyntaxHighlighter(
			(code: string, lang: string | undefined) =>
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
			(code: string, lang: string | undefined) =>
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

	test("lang is undefined for unspecified language", () => {
		let receivedLang: unknown = "not-called";
		const sh = new SyntaxHighlighter(
			(code: string, lang: string | undefined) => {
				receivedLang = lang;
				return code;
			},
			() => "<pre>",
			() => "<code>",
		);
		mdToHtmlWithPlugins("```\nno lang\n```", { render: { unsafe: true } }, sh);
		expect(receivedLang === undefined || receivedLang === "").toBe(true);
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

	test("with heading adapter", () => {
		const ha = new HeadingAdapter(
			(heading: HeadingMeta) => `<h${heading.level}>`,
			(heading: HeadingMeta) => `</h${heading.level}>`,
		);
		const xml = mdToXmlWithPlugins("# Hello", {}, null, ha);
		expect(xml).toContain("<?xml");
		expect(xml).toContain("Hello");
	});
});

// --- Typst ---

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
});

// --- Text Output ---

describe("text", () => {
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
		const md =
			"- Item one\n\n        code inside\n\n- Item two\n- Item three";
		const text = mdToText(md, {});
		const ansi = mdToAnsi(md, {}).replace(/\x1b\[[0-9;]*m/g, "");
		expect(ansi).toBe(text);
	});

	test("text and ansi match for nested list with code block", () => {
		const md =
			"- Item\n    - Sub-item\n\n            nested_code()\n\n- Next";
		const text = mdToText(md, {});
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

	test("dark and light themes return valid objects", () => {
		expect(ansiThemeDark().heading).toBeDefined();
		expect(ansiThemeLight().heading).toBeDefined();
	});
});

// --- Heal Markdown ---

describe("heal", () => {
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
		expect(healMarkdown("Text\u200Bwith\u200BZWSP")).toBe("Text\u200Bwith\u200BZWSP");
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

	test("mdToHtml does not leak memory over repeated calls", () => {
		// Warm up
		for (let i = 0; i < 10; i++) mdToHtml(md, opts);
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) mdToHtml(md, opts);
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	});

	test("mdToText does not leak memory over repeated calls", () => {
		for (let i = 0; i < 10; i++) mdToText(md, opts);
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) mdToText(md, opts);
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	});

	test("mdToAnsi does not leak memory over repeated calls", () => {
		for (let i = 0; i < 10; i++) mdToAnsi(md, opts);
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) mdToAnsi(md, opts);
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	});

	test("healMarkdown does not leak memory over repeated calls", () => {
		const incomplete = "**bold\n```js\ncode\n~~strike";
		for (let i = 0; i < 10; i++) healMarkdown(incomplete);
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) healMarkdown(incomplete);
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	});

	test("mdToHtmlWithPlugins does not leak memory over repeated calls", () => {
		for (let i = 0; i < 10; i++) {
			const sh = new SyntaxHighlighter(
				(code: string) => code,
				() => "<pre>",
				() => "<code>",
			);
			mdToHtmlWithPlugins(md, opts, sh);
		}
		const before = getWasmPages();
		for (let i = 0; i < 1000; i++) {
			const sh = new SyntaxHighlighter(
				(code: string) => code,
				() => "<pre>",
				() => "<code>",
			);
			mdToHtmlWithPlugins(md, opts, sh);
		}
		const after = getWasmPages();
		expect(after - before).toBeLessThanOrEqual(1);
	});
});
