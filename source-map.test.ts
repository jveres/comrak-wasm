import { readFileSync } from "node:fs";
import { initSync, mdToHtmlBlocks, mdToStreamingHtmlBlocks } from "comrak-wasm";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() =>
	initSync({
		module: readFileSync(new URL("./pkg/comrak.wasm", import.meta.url)),
	}),
);
const options = {
	parse: { smart: true },
	extension: { table: true, tasklist: true, autolink: true, mathDollars: true },
};

describe("lexical source mappings", () => {
	it.each(["", "\n", "\n\n", "\r\n"])(
		"should not leak synthetic underscore after display math with suffix %j",
		(suffix) => {
			const source = `$$\na_{11}\n$$${suffix}`;
			for (const mapped of [false, true]) {
				const { html } = mdToStreamingHtmlBlocks(
					source,
					source.length,
					options,
					mapped,
				);
				const outsideMath = html
					.replace(/<span[^>]*data-math-style="display">[\s\S]*?<\/span>/g, "")
					.replace(/<[^>]+>/g, "")
					.replaceAll("\u2060", "")
					.trim();
				expect(outsideMath).toBe("");
				expect(html).toContain("a_{11}");
			}
		},
	);
	it.each([false, true])(
		"should preserve character source positions when mapped: streaming=%s",
		(streaming) => {
			const source = "😀 **日本語**";
			const opts = {
				parse: { sourceposChars: true },
				render: { sourcepos: true },
			};
			const plain = streaming
				? mdToStreamingHtmlBlocks(source, source.length, opts)
				: mdToHtmlBlocks(source, opts);
			const mapped = streaming
				? mdToStreamingHtmlBlocks(source, source.length, opts, true)
				: mdToHtmlBlocks(source, opts, true);
			expect(
				mapped.html.replace(
					/<span data-md-source="[\d,;]+">([\s\S]*?)<\/span>/g,
					"$1",
				),
			).toBe(plain.html);
			expect(mapped.html).toContain('data-md-source="5,8,3,1"');
		},
	);
	it("should retain entity and smart punctuation boundaries before text coalescing", () => {
		const source = "Before &amp; after...";
		const { html } = mdToHtmlBlocks(source, options, true);
		expect(html).toContain(
			'data-md-source="0,7,7,1;7,12,1,0;12,18,6,1;18,21,1,0"',
		);
	});
	it.each([
		"**bold**",
		"__bold__",
		"***bold italic***",
		"[bold](https://example.com)",
		"`inline code`",
		"&amp; after",
		"日本語 😀",
		"\\*escaped\\*",
	])("should map visible text at every streaming boundary of %s", (text) => {
		const source = `Before ${text} after`;
		for (let cut = 7; cut <= source.length; cut++) {
			if (cut > 0 && /[\uD800-\uDBFF]/.test(source[cut - 1] ?? "")) continue;
			const partial = source.slice(0, cut);
			const plain = mdToStreamingHtmlBlocks(partial, partial.length, options);
			const mapped = mdToStreamingHtmlBlocks(
				partial,
				partial.length,
				options,
				true,
			);
			expect(
				mapped.html
					.replace(/<span data-md-source="[\d,;]+">([\s\S]*?)<\/span>/g, "$1")
					.replace(/ data-md-source="[\d,;]+"/g, ""),
			).toBe(plain.html);
			expect(mapped.blockEnds?.at(-1)).toBe(mapped.html.length);
		}
	});
	it.each([
		"```js\nconst x=1;\nconst y=2;\n```",
		"> ```js\n> const x=1;\n> ```",
		"- item\n\n  ```js\n  const x=1;\n  ```",
	])(
		"should preserve literal code provenance inside containers: %s",
		(source) => {
			expect(
				mdToStreamingHtmlBlocks(source, source.length, options, true).html,
			).toMatch(/<code data-md-source="[\d,;]+"/);
		},
	);
	it("should expose an atomic formula source range", () => {
		const source = "Before $x^2$";
		expect(
			mdToStreamingHtmlBlocks(source, source.length, options, true).html,
		).toContain(`data-md-atomic="7,${source.length}"`);
	});
	it("should map shortcode output as one lexical unit", () => {
		const result = mdToHtmlBlocks(
			"Before :smile: after",
			{
				extension: { shortcodes: true },
			},
			true,
		);
		expect(result.html).toContain('<span data-md-source="7,14,2,0">😄</span>');
	});
	it("should map partially expanded indentation tabs without losing code", () => {
		const result = mdToHtmlBlocks(
			"- item\n\n  ```\n\tcode\n  ```",
			options,
			true,
		);
		expect(result.html).toContain(
			'<code data-md-source="14,15,2,0;15,20,5,1">  code\n</code>',
		);
	});
	it("should retain container offsets when normalizing multiline inline code", () => {
		const result = mdToHtmlBlocks("> ``code\n> next``", options, true);
		expect(result.html).toContain(
			'<code data-md-source="4,8,4,1;8,9,1,0;11,15,4,1">code next</code>',
		);
	});
	it("should keep mapping tab-indented code in a streaming list fence", () => {
		const source = "Before \n\n- item\n\n  ```\n\tcode\n  `";
		const { html } = mdToStreamingHtmlBlocks(
			source,
			source.length,
			options,
			true,
		);

		// The partial closer is code, not an inline code span to heal.
		expect(html).toMatch(/<code data-md-source="[^"]*">\s*code\n`/);
	});
});
