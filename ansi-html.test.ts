import { readFileSync } from "node:fs";
import { ansiToHtml, initSync } from "comrak-wasm";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() =>
	initSync({
		module: readFileSync(new URL("./pkg/comrak.wasm", import.meta.url)),
	}),
);

const escapeText = (s: string) =>
	s
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
const plainHtml = (html: string) => html.replace(/<\/?span\b[^>]*>/g, "");

describe("ANSI input to HTML", () => {
	it("property: retains text and source ownership across inserted terminal controls", () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.record({
						control: fc.constantFrom(
							"\u001b[31m",
							"\\e[0m",
							"\\033[1m",
							"\\u001b[4m",
							"\\x1b[39m",
							"^[[22m",
							"\u001b]0;title\u0007",
							"\u001b[2K",
							"\u0007",
						),
						text: fc
							.array(
								fc.constantFrom(
									"a",
									" ",
									"é",
									"🙂",
									"漢",
									"<",
									">",
									"&",
									"'",
									'"',
									"\n",
								),
								{ minLength: 1, maxLength: 12 },
							)
							.map((a) => a.join("")),
					}),
					{ minLength: 1, maxLength: 20 },
				),
				(chunks) => {
					const source = chunks.map((c) => c.control + c.text).join("");
					const expected = chunks.map((c) => c.text).join("");
					const result = ansiToHtml(
						source,
						true,
						`0,${source.length},${source.length},1`,
					);
					expect(plainHtml(result.html)).toBe(escapeText(expected));
					expect(result.html).toBe(ansiToHtml(source, true).html);
					let mapped = "";
					for (const run of (result.sourceMap ?? "").split(";")) {
						const [a, b, length, linear] = run.split(",").map(Number);
						if (a === undefined || b === undefined)
							throw new Error("Missing source offsets");
						expect(linear).toBe(1);
						expect(b - a).toBe(length);
						mapped += source.slice(a, b);
					}
					expect(mapped).toBe(expected);
				},
			),
			{ numRuns: 200, seed: 15092026 },
		);
	});

	it.each(["\u001b[", "\\e[", "\\033[", "\\x1b[", "\\u001b[", "^[["])(
		"should handle partial controls starting with %j",
		(prefix) => {
			const sequence = `${prefix}38;2;12;34;56m`;
			for (let end = prefix.length; end < sequence.length; end++) {
				expect(ansiToHtml(`old${sequence.slice(0, end)}`, true).html).toBe(
					"old",
				);
			}
			expect(ansiToHtml(`old${sequence}new`, true).html).toBe(
				'old<span class="ansi" style="color:rgb(12,34,56)">new</span>',
			);
		},
	);

	it("should preserve atomic indentation provenance and non-contiguous source lines", () => {
		expect(
			ansiToHtml("\u001b[0m    x", false, "0,4,4,1;10,11,4,0;20,21,1,1"),
		).toEqual({ html: "    x", sourceMap: "10,11,4,0;20,21,1,1" });
	});

	it.each([
		"",
		"0,3,2,1",
		"0,3,0,0",
		"0,3,3,2",
		"0,3,3,1,5",
		"-1,3,4,1",
		"0,9999999999999999999999999,3,1",
	])("should reject malformed map %j without affecting HTML", (map) => {
		expect(ansiToHtml("abc", false, map)).toEqual({
			html: "abc",
			sourceMap: "",
		});
	});

	it("should never interpret terminal hyperlinks or HTML as active content", () => {
		const source =
			'\u001b]8;;javascript:alert(1)\u0007<img src=x onerror="alert(1)">\u001b]8;;\u0007';
		expect(ansiToHtml(source).html).toBe(
			"&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
		);
	});
});

describe("ANSI input to HTML: non-SGR escapes", () => {
	it.each([
		[
			"\u001b[31mred\u001b(B\u001b[m plain",
			'<span class="ansi ansi-fg-1">red</span> plain',
		],
		["a\u001b[>0cb", "ab"],
		["a\u001b[>4;2mb", "ab"],
		["a\u001b[?25lb", "ab"],
		["a\u001b7b\u001b8c", "abc"],
		["a\u001b\u0001b", "a\u0001b"],
		["a\u001b", "a"],
	])("should drop escapes in %j without leaking ESC", (input, html) => {
		const out = ansiToHtml(input).html;
		expect(out).toBe(html);
		expect(out).not.toContain("\u001b");
	});

	it("should map text around dropped charset escapes", () => {
		const code = "ab\u001b(Bcd";
		expect(
			ansiToHtml(code, false, `0,${code.length},${code.length},1`),
		).toEqual({ html: "abcd", sourceMap: "0,2,2,1;5,7,2,1" });
	});
});
