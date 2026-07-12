import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { fileURLToPath } from "node:url";

// Run after `pnpm run build` with: node bench/wasm.mjs
// Optional controls: COMRAK_BENCH_SAMPLES, COMRAK_BENCH_WARMUPS,
// COMRAK_BENCH_TARGET_MIB, and COMRAK_BENCH_JSON=1.
const KIB = 1024;
const MIB = 1024 * KIB;
const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 1;
const DEFAULT_TARGET_MIB_PER_SAMPLE = 2;

let sink = 0;

function readPositiveNumber(name, fallback, integer = false) {
	const raw = process.env[name];
	if (raw === undefined) return fallback;

	const value = Number(raw);
	if (
		!Number.isFinite(value) ||
		value <= 0 ||
		(integer && !Number.isInteger(value))
	) {
		throw new Error(
			`${name} must be a positive${integer ? " integer" : " number"}`,
		);
	}
	return value;
}

const sampleCount = readPositiveNumber(
	"COMRAK_BENCH_SAMPLES",
	DEFAULT_SAMPLE_COUNT,
	true,
);
const warmupCount = readPositiveNumber(
	"COMRAK_BENCH_WARMUPS",
	DEFAULT_WARMUP_COUNT,
	true,
);
const targetBytesPerSample = Math.round(
	readPositiveNumber("COMRAK_BENCH_TARGET_MIB", DEFAULT_TARGET_MIB_PER_SAMPLE) *
		MIB,
);

function makeParagraphSplitInput(size) {
	const unit = `${"a".repeat(78)}\n\n`;
	return (
		unit.repeat(Math.floor(size / unit.length)) +
		unit.slice(0, size % unit.length)
	);
}

function makeRepresentativeMarkdown(minimumBytes) {
	const sections = [];
	let byteLength = 0;

	for (let index = 0; byteLength < minimumBytes; index += 1) {
		const section = [
			`## Section ${index}`,
			"",
			"A representative paragraph with **bold**, *emphasis*, `code`, and ~~deleted text~~.",
			"",
			`> [!NOTE]\n> Quoted alert content for section ${index}.`,
			"",
			"- [x] completed task",
			"- [ ] pending task",
			"",
			"| name | value |",
			"| :--- | ---: |",
			`| item-${index} | ${index} |`,
			"",
			"```js",
			`const value${index} = ${index};`,
			"```",
			"",
			`[link-${index}](https://example.test/${index}) and reference[^note-${index}].`,
			"",
			`[^note-${index}]: Footnote content for section ${index}.`,
			"",
		].join("\n");

		sections.push(section);
		byteLength += Buffer.byteLength(section);
	}

	return sections.join("");
}

function median(values) {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle];
}

function runBatch(run, iterations) {
	let localSink = 0;
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		localSink = (localSink + run().length) >>> 0;
	}
	sink = Math.imul(sink ^ localSink, 16_777_619) >>> 0;
}

function benchmark({ name, input, run }) {
	const inputBytes = Buffer.byteLength(input);
	const iterations = Math.max(1, Math.ceil(targetBytesPerSample / inputBytes));
	const output = run();
	if (typeof output !== "string") {
		throw new TypeError(`${name} returned ${typeof output}, expected a string`);
	}
	const outputBytes = Buffer.byteLength(output);

	for (let warmup = 0; warmup < warmupCount; warmup += 1) {
		runBatch(run, iterations);
	}

	const nanosecondsPerOperation = [];
	for (let sample = 0; sample < sampleCount; sample += 1) {
		const start = process.hrtime.bigint();
		runBatch(run, iterations);
		const elapsedNanoseconds = Number(process.hrtime.bigint() - start);
		nanosecondsPerOperation.push(elapsedNanoseconds / iterations);
	}

	const medianNanoseconds = median(nanosecondsPerOperation);
	return {
		name,
		inputBytes,
		outputBytes,
		iterations,
		medianMicroseconds: medianNanoseconds / 1_000,
		mibPerSecond: inputBytes / MIB / (medianNanoseconds / 1_000_000_000),
		operationsPerSecond: 1_000_000_000 / medianNanoseconds,
		minimumMicroseconds: Math.min(...nanosecondsPerOperation) / 1_000,
		maximumMicroseconds: Math.max(...nanosecondsPerOperation) / 1_000,
	};
}

function formatBytes(bytes) {
	if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
	if (bytes >= KIB) return `${(bytes / KIB).toFixed(2)} KiB`;
	return `${bytes} B`;
}

function printResults(results) {
	console.log("");
	console.log(
		"| benchmark | input | output | iterations/sample | median us/op | MiB/s | ops/s | sample range us/op |",
	);
	console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
	for (const result of results) {
		console.log(
			`| ${result.name} | ${formatBytes(result.inputBytes)} | ${formatBytes(result.outputBytes)} | ${result.iterations} | ${result.medianMicroseconds.toFixed(2)} | ${result.mibPerSecond.toFixed(2)} | ${result.operationsPerSecond.toFixed(0)} | ${result.minimumMicroseconds.toFixed(2)}-${result.maximumMicroseconds.toFixed(2)} |`,
		);
	}
}

async function main() {
	const glueUrl = new URL("../index.js", import.meta.url);
	const wasmUrl = new URL("../pkg/comrak.wasm", import.meta.url);
	const wasmBytes = await readFile(wasmUrl);
	const { comrakVersion, healMarkdown, initSync, mdToHtml, mdToText } =
		await import(glueUrl.href);

	initSync({ module: wasmBytes });

	const representativeMarkdown = makeRepresentativeMarkdown(16 * KIB);
	const representativeOptions = {
		extension: {
			alerts: true,
			autolink: true,
			footnotes: true,
			strikethrough: true,
			table: true,
			tasklist: true,
		},
		parse: { smart: true },
		render: { compactHtml: true },
	};

	const cases = [];
	for (const [label, size] of [
		["1KiB", 1 * KIB],
		["16KiB", 16 * KIB],
		["256KiB", 256 * KIB],
	]) {
		const plain = "a".repeat(size);
		const paragraphs = makeParagraphSplitInput(size);
		cases.push(
			{
				name: `heal/single-paragraph/${label}`,
				input: plain,
				run: () => healMarkdown(plain),
			},
			{
				name: `heal/paragraph-split/${label}`,
				input: paragraphs,
				run: () => healMarkdown(paragraphs),
			},
		);
	}
	cases.push(
		{
			name: "mdToHtml/mixed",
			input: representativeMarkdown,
			run: () => mdToHtml(representativeMarkdown, representativeOptions),
		},
		{
			name: "mdToText/mixed",
			input: representativeMarkdown,
			run: () =>
				mdToText(
					representativeMarkdown,
					representativeOptions,
					true,
					false,
					"",
				),
		},
	);

	const cpu = cpus()[0];
	const wasmHash = createHash("sha256").update(wasmBytes).digest("hex");
	console.log("comrak-wasm Node/Wasm benchmark");
	console.log(`comrak: ${comrakVersion()}`);
	console.log(`node: ${process.version}; V8 ${process.versions.v8}`);
	console.log(
		`host: ${platform()} ${release()} ${arch()}; ${cpus().length} logical CPUs; ${cpu?.model ?? "unknown CPU"}; ${(totalmem() / 1024 ** 3).toFixed(1)} GiB RAM`,
	);
	console.log(
		`artifact: ${fileURLToPath(wasmUrl)}; ${formatBytes(wasmBytes.byteLength)}; sha256 ${wasmHash.slice(0, 16)}`,
	);
	console.log(
		`config: ${warmupCount} warmup(s), ${sampleCount} sample(s), ${formatBytes(targetBytesPerSample)} input/sample target`,
	);

	const results = cases.map(benchmark);
	printResults(results);
	console.log(`\nchecksum: ${sink}`);

	if (process.env.COMRAK_BENCH_JSON === "1") {
		console.log("\nJSON:");
		console.log(
			JSON.stringify(
				{
					comrak: comrakVersion(),
					node: process.version,
					platform: `${platform()} ${release()} ${arch()}`,
					wasmBytes: wasmBytes.byteLength,
					wasmSha256: wasmHash,
					warmupCount,
					sampleCount,
					targetBytesPerSample,
					results,
				},
				null,
				2,
			),
		);
	}
}

main().catch((error) => {
	console.error(
		"Unable to run the Wasm benchmark. Build the package with `pnpm run build` first.",
	);
	console.error(error);
	process.exitCode = 1;
});
