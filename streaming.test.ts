import { readFileSync } from "node:fs";
import { initSync, mdToStreamingHtml } from "comrak-wasm";
import { beforeAll, describe, expect, test } from "vitest";

const cursor = "\u2060";
beforeAll(() => {
	initSync({
		module: readFileSync(new URL("./pkg/comrak.wasm", import.meta.url)),
	});
});

describe("streaming HTML", () => {
	test.each([
		["**bold", `<p><strong>bold${cursor}</strong></p>\n`],
		["* s", `<ul>\n<li>s${cursor}</li>\n</ul>\n`],
		["[unfinished", `<p>[unfinished${cursor}</p>\n`],
		["<span", `<p>&lt;span${cursor}</p>\n`],
		["a * b", `<p>a * b${cursor}</p>\n`],
		["```\n**literal_\n", `<pre><code>**literal_\n${cursor}\n</code></pre>\n`],
		["Use ``", `<p>Use <code>${cursor}</code></p>\n`],
	])("renders %j without changing visible input", (source, expected) => {
		expect(mdToStreamingHtml(source, source.length)).toBe(expected);
	});

	test.each([false, true])(
		"handles Unicode source positions (character columns=%s)",
		(sourceposChars) => {
			const source = "**世界😀";
			expect(
				mdToStreamingHtml(source, source.length, { parse: { sourceposChars } }),
			).toBe(`<p><strong>世界😀${cursor}</strong></p>\n`);
		},
	);

	test("uses a UTF-16 prefix offset", () => {
		expect(mdToStreamingHtml("A😀B", 3)).toBe(`<p>A😀${cursor}</p>\n`);
		expect(mdToStreamingHtml("A😀B", 0)).toBe(cursor);
	});

	test.each([-1, 0.5, 2, 5, Number.NaN, Number.POSITIVE_INFINITY])(
		"rejects invalid offset %s",
		(offset) => {
			expect(() => mdToStreamingHtml("A😀B", offset)).toThrow(/writingOffset/);
		},
	);

	test("keeps the cursor out of heading metadata and after generated footnotes", () => {
		for (const source of ["# Heading", "See[^a].\n\n[^a]: Details."]) {
			const html = mdToStreamingHtml(source, source.length, {
				extension: { headerIdPrefix: "", footnotes: true },
			});
			expect(html.split(cursor)).toHaveLength(2);
			expect(html).not.toMatch(new RegExp(`<[^>]*${cursor}[^>]*>`));
			if (source.includes("[^a]")) {
				expect(html.indexOf(cursor)).toBeGreaterThan(
					html.indexOf("</section>"),
				);
			}
		}
	});
});
