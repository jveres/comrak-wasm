import { readFileSync } from "node:fs";
import {
	initSync,
	mdToHtml,
	mdToHtmlBlocks,
	mdToStreamingHtml,
	mdToStreamingHtmlBlocks,
} from "comrak-wasm";
import { beforeAll, describe, expect, test } from "vitest";

beforeAll(() => {
	initSync({
		module: readFileSync(new URL("./pkg/comrak.wasm", import.meta.url)),
	});
});

const options = {
	extension: {
		headerIdPrefix: "",
		table: true,
		footnotes: true,
		mathDollars: true,
	},
	render: { unsafe: true },
};

function fragments(snapshot: ReturnType<typeof mdToHtmlBlocks>) {
	let start = 0;
	return snapshot.blockEnds?.map((end) => {
		const block = snapshot.html.slice(start, end);
		start = end;
		return block;
	});
}

describe("HTML block snapshots", () => {
	test.each([
		"",
		"# Repeat\n\n# Repeat\n\nParagraph 😀 世界",
		"- one\n- two\n\n---\n\nEnd",
		"| A | B |\n| - | - |\n| α | β |",
		"See[^a] twice[^a].\n\n[^a]: First\n\n    Second",
		"[early][ref]\n\nTail\n\n[ref]: https://example.com",
		"```text\n<literal>\n```\n\n$$x^2$$",
	])("preserves full renderer output and UTF-16 boundaries: %j", (source) => {
		const snapshot = mdToHtmlBlocks(source, options);
		expect(snapshot.html).toBe(mdToHtml(source, options));
		expect(snapshot.blockEnds).not.toBeNull();
		expect(fragments(snapshot)?.join("")).toBe(snapshot.html);
		expect(
			snapshot.blockEnds?.every((end, i, ends) => end > (ends[i - 1] ?? 0)),
		).toBe(true);
	});

	test("keeps footnotes together and shares heading ID allocation", () => {
		const source =
			"# Same\n\n# Same\n\nA[^a] B[^b].\n\n[^a]: First\n\n[^b]: Second";
		const blocks = fragments(mdToHtmlBlocks(source, options));
		expect(blocks).toHaveLength(4);
		expect(blocks?.[0]).toContain('id="same"');
		expect(blocks?.[1]).toContain('id="same-1"');
		expect(blocks?.[3]).toContain('id="fn-a"');
		expect(blocks?.[3]).toContain('id="fn-b"');
		expect(blocks?.[3]).toMatch(/<\/section>\n$/);
	});

	test.each([
		"<div>\n\ninside\n\n</div>",
		"Before <span>raw</span> after",
		"<table>\ntext\n</table>",
	])(
		"declines independent boundaries for context-sensitive HTML: %j",
		(source) => {
			expect(mdToHtmlBlocks(source, options).blockEnds).toBeNull();
			expect(
				mdToStreamingHtmlBlocks(source, source.length, options).blockEnds,
			).toBeNull();
		},
	);

	test("reports changed earlier output when a reference definition arrives", () => {
		const first = "[early][ref]\n\nTail";
		const next = `${first}\n\n[ref]: https://example.com`;
		const before = fragments(
			mdToStreamingHtmlBlocks(first, first.length, options),
		);
		const after = fragments(
			mdToStreamingHtmlBlocks(next, next.length, options),
		);
		expect(before?.[0]).not.toBe(after?.[0]);
		expect(after?.[0]).toContain('href="https://example.com"');
	});

	test.each([
		"# Title\n\nA **bold** paragraph 😀.\n\n- one\n- two\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```text\ncode\n```\n\nTail",
		"See[^a].\n\n[^a]: Footnote.",
	])("matches streaming output at every UTF-16 boundary: %j", (source) => {
		let offset = 0;
		for (const character of ["", ...source]) {
			offset += character.length;
			const snapshot = mdToStreamingHtmlBlocks(source, offset, options);
			expect(snapshot.html).toBe(mdToStreamingHtml(source, offset, options));
			expect(fragments(snapshot)?.join("")).toBe(snapshot.html);
		}
	});
});
