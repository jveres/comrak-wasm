import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	type AstNode,
	type ComrakOptions,
	initSync,
	mdToAst,
	mdToHtml,
	mdToHtmlBlocks,
	mdToStreamingHtmlBlocks,
} from "comrak-wasm";
import fc from "fast-check";
import { beforeAll, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
beforeAll(() =>
	initSync({
		module: readFileSync(new URL("./pkg/comrak.wasm", import.meta.url)),
	}),
);

const attributesOptions: ComrakOptions = {
	extension: {
		headerAttributes: true,
		fencedCodeAttributes: true,
		inlineCodeAttributes: true,
		linkAttributes: true,
	},
};
function nodes(root: AstNode): AstNode[] {
	return [root, ...(root.children ?? []).flatMap(nodes)];
}
const attributes =
	'{#first #last .wide .wide key="one" key="two" title="日本語 😀"}';
it.each([
	["heading", `# Heading ${attributes}`],
	["heading", `Heading ${attributes}\n=======`],
	["codeBlock", `\`\`\`js ${attributes}\nconst value = 1;\n\`\`\``],
	["code", `\`inline\`${attributes}`],
	["link", `[label](https://example.com)${attributes}`],
	["image", `![label](image.png)${attributes}`],
])("should preserve parsed attributes on %s", (type, source) => {
	const node = nodes(mdToAst(source, attributesOptions)).find(
		(node) => node.type === type,
	);
	expect(node?.attributes).toEqual({
		id: "last",
		classes: ["wide", "wide"],
		pairs: [
			["key", "one"],
			["key", "two"],
			["title", "日本語 😀"],
		],
	});
	expect(mdToHtml(source, attributesOptions)).not.toMatch(
		/id="last"|class="wide"|key="two"/,
	);
});

it("should omit attributes when absent or parsing is disabled", () => {
	for (const source of ["# Heading", "# Heading {#name}", "`code`{#name}"]) {
		for (const node of nodes(mdToAst(source)))
			expect(node).not.toHaveProperty("attributes");
	}
	for (const node of nodes(mdToAst("# Heading", attributesOptions)))
		expect(node).not.toHaveProperty("attributes");
});

it("should preserve arbitrary attribute keys as pairs without changing object prototypes", () => {
	const node = mdToAst(
		'# Heading {prototype="value" constructor="other"}',
		attributesOptions,
	).children?.[0];
	expect(node?.attributes).toEqual({
		classes: [],
		pairs: [
			["prototype", "value"],
			["constructor", "other"],
		],
	});
	expect(Object.getPrototypeOf(node?.attributes)).toBe(Object.prototype);
});

it("property: should preserve attribute class and pair order", () => {
	const word = fc
		.array(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 8 })
		.map((chars) => chars.join(""));
	fc.assert(
		fc.property(
			fc.array(word, { maxLength: 6 }),
			fc.array(fc.tuple(word, word), { minLength: 1, maxLength: 6 }),
			(classes, pairs) => {
				const source = `# Heading {${[...classes.map((name) => `.${name}`), ...pairs.map(([key, value]) => `${key}=${value}`)].join(" ")}}`;
				expect(
					mdToAst(source, attributesOptions).children?.[0]?.attributes,
				).toEqual({ classes, pairs });
			},
		),
		{ numRuns: 100, seed: 550 },
	);
});

it.each([false, true])(
	"should preserve autolink source ownership at every UTF-16 boundary (character columns=%s)",
	(sourceposChars) => {
		const source =
			"😀 **before** a@b.co a@b.co 日本語 https://example.com/x(foo)) after";
		const options = {
			extension: { autolink: true },
			parse: { sourceposChars },
		};
		for (let cut = 2; cut <= source.length; cut++) {
			const partial = source.slice(0, cut);
			for (const streaming of [false, true]) {
				const mapped = streaming
					? mdToStreamingHtmlBlocks(partial, cut, options, true)
					: mdToHtmlBlocks(partial, options, true);
				const plain = streaming
					? mdToStreamingHtmlBlocks(partial, cut, options)
					: mdToHtmlBlocks(partial, options);
				expect(
					mapped.html.replace(
						/<span data-md-source="[\d,;]+">([\s\S]*?)<\/span>/g,
						"$1",
					),
				).toBe(plain.html);
				let covered = "";
				for (const match of mapped.html.matchAll(
					/<span data-md-source="([\d,;]+)">([^<]*)<\/span>/g,
				)) {
					const rendered = match[2] ?? "";
					let offset = 0;
					for (const tuple of (match[1] ?? "").split(";")) {
						const [start = -1, end = -1, length = -1, linear] = tuple
							.split(",")
							.map(Number);
						expect(start).toBeGreaterThanOrEqual(0);
						expect(end).toBeLessThanOrEqual(cut);
						if (linear === 1)
							expect(rendered.slice(offset, offset + length)).toBe(
								partial.slice(start, end),
							);
						offset += length;
					}
					expect(offset).toBe(rendered.length);
					covered += rendered;
				}
				const visible = plain.html
					.replace(/<[^>]+>/g, "")
					.replaceAll("\u2060", "")
					.trimEnd();
				expect(covered.trimEnd()).toBe(visible);
			}
		}
	},
);

it.each(["emails", "parentheses", "brackets", "braces"])(
	"should complete hostile %s input in an isolated WASM process",
	async (kind) => {
		const { stdout } = await execFileAsync(
			process.execPath,
			[
				fileURLToPath(
					new URL("./scripts/autolink-worker.mjs", import.meta.url),
				),
				kind,
			],
			{ timeout: 10000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
		);
		expect(JSON.parse(stdout)).toMatchObject({ kind, passed: true });
	},
	15000,
);
