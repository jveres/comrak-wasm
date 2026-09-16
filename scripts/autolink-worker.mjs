import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import * as api from "../index.js";

// This process is disposable: the parent enforces a hard timeout even when
// synchronous Wasm traps or never returns. Do not run hostile input in-process.
const kind = process.argv[2];
assert.ok(["emails", "parentheses", "brackets", "braces"].includes(kind));
api.initSync({
	module: readFileSync(new URL("../pkg/comrak.wasm", import.meta.url)),
});
const suffix = kind === "parentheses" ? ")" : kind === "brackets" ? "]" : "}";
const source =
	kind === "emails"
		? "a@b.co ".repeat(10000)
		: `http://a.b${suffix.repeat(100000)}`;
const options = {
	extension: { autolink: true },
	parse: { relaxedAutolinks: true },
};
const expected =
	kind === "emails"
		? `<p>${'<a href="mailto:a@b.co">a@b.co</a> '.repeat(10000).trimEnd()}</p>\n`
		: `<p><a href="http://a.b">http://a.b</a>${suffix.repeat(100000)}</p>\n`;
const prepared = new api.PreparedOptions(options);
try {
	assert.equal(api.mdToHtml(source, options), expected);
	assert.equal(prepared.mdToHtml(source), expected);
	assert.equal(api.mdToHtmlBlocks(source, options).html, expected);
	const mapped = api.mdToHtmlBlocks(source, options, true).html;
	assert.equal(
		mapped.replace(/<span data-md-source="[\d,;]+">([\s\S]*?)<\/span>/g, "$1"),
		expected,
	);
	assert.equal(api.mdToText(source, options), source.trimEnd());
	assert.equal(
		stripVTControlCharacters(
			api.mdToAnsi(source, options, { showUrls: false, showMarkdown: false }),
		),
		source.trimEnd(),
	);
	for (const sourceMap of [false, true]) {
		assert.equal(
			api
				.mdToStreamingHtmlBlocks(source, source.length, options, sourceMap)
				.html.replace(
					/<span data-md-source="[\d,;]+">([\s\S]*?)<\/span>/g,
					"$1",
				)
				.replaceAll("\u2060", ""),
			expected,
		);
	}
	assert.equal(
		api.mdToHtml(api.mdToCommonmark(source, options), options),
		expected,
	);
	assert.ok(api.mdToXml(source, options).includes('destination="'));
	assert.equal(
		api
			.mdToAst(source, options)
			.children[0].children.filter((node) => node.type === "link").length,
		kind === "emails" ? 10000 : 1,
	);
	console.log(JSON.stringify({ kind, passed: true }));
} finally {
	prepared.free();
}
