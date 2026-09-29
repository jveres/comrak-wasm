// Run after pnpm run build. Three warm comparisons over deterministic prefixes.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { initSync, mdToStreamingHtmlBlocks } from "../index.js";

const wasm = readFileSync(new URL("../pkg/comrak.wasm", import.meta.url));
const instance = initSync({ module: wasm });
const options = {
	extension: { table: true, autolink: true, tasklist: true, mathDollars: true },
};
/** @param {number} i */
const section = (i) =>
	`\n\n## Streaming section ${i}\n\n` +
	"Inspect **stable geometry**, _incremental rendering_, and `scrollTop`. ".repeat(
		8,
	) +
	"\n\n| Stage | Value | State |\n| --- | ---: | --- |\n| Decode | 12 | Ready |\n| Render | 24 | Active |\n" +
	`\n\n\`\`\`typescript\ninterface Row { id: string; height: number; }\nconst stage = ${i};\n\`\`\`\n` +
	"\n$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$\n" +
	"\n- Keep the reading anchor stable.\n- Measure the actual work.\n\n> Synthetic input, served locally.\n" +
	(i % 8 === 0 ? "\n![Synthetic chart](/__chat-profile/image.svg)\n" : "");
/** @type {Array<[string, string]>} */
const cases = [
	[
		"plain-paragraph",
		"Plain words describe stable reading and predictable rendering. ".repeat(
			640,
		),
	],
	[
		"plain-blocks",
		"A plain paragraph describes stable reading.\n\n".repeat(640),
	],
	["rich-chat", Array.from({ length: 48 }, (_, i) => section(i)).join("")],
	[
		"open-code",
		"```typescript\n" +
			"const value = 42; // a growing code fence\n".repeat(640),
	],
];
const results = [];
for (const [name, source] of cases) {
	/** @type {string[]} */
	const prefixes = [];
	for (let end = 96; end < source.length; end += 96)
		prefixes.push(source.slice(0, end));
	prefixes.push(source);
	const run = () => {
		let bytes = 0;
		for (const prefix of prefixes) {
			bytes += mdToStreamingHtmlBlocks(prefix, prefix.length, options, true)
				.html.length;
		}
		return bytes;
	};
	run();
	const samples = [];
	for (let sample = 0; sample < 3; sample++) {
		const start = performance.now();
		const outputCharacters = run();
		samples.push({ ms: performance.now() - start, outputCharacters });
	}
	const hash = createHash("sha256");
	for (const prefix of prefixes)
		hash.update(
			JSON.stringify(
				mdToStreamingHtmlBlocks(prefix, prefix.length, options, true),
			),
		);
	results.push({
		name,
		characters: source.length,
		prefixes: prefixes.length,
		sourceSha256: createHash("sha256").update(source).digest("hex"),
		outputSha256: hash.digest("hex"),
		samples,
	});
}
console.log(
	JSON.stringify(
		{
			node: process.version,
			cpu: cpus()[0]?.model,
			build: "cargo release opt-level=s, lto=true, wasm-opt -Oz",
			wasmSha256: createHash("sha256").update(wasm).digest("hex"),
			wasmBytes: wasm.length,
			wasmPages: instance.memory.buffer.byteLength / 65536,
			results,
		},
		null,
		2,
	),
);
