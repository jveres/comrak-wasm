// @ts-check

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { fileURLToPath } from "node:url";

// Run after `pnpm run build` with: node bench/wasm.mjs
// Optional controls: COMRAK_BENCH_SAMPLES, COMRAK_BENCH_WARMUPS,
// COMRAK_BENCH_TARGET_MIB, and COMRAK_BENCH_JSON=1.
const KIB = 1024;
const MIB = 1024 * KIB;
const WASM_PAGE_BYTES = 64 * KIB;
const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 1;
const DEFAULT_TARGET_MIB_PER_SAMPLE = 2;
const LARGE_CASE_ITERATIONS = 1;
const TINY_CASE_ITERATIONS = 10_000;
const JSON_OUTPUT_ENV = "COMRAK_BENCH_JSON";

/** @typedef {import("../types.d.ts").ComrakOptions} ComrakOptions */
/** @typedef {import("../types.d.ts").HeadingMeta} HeadingMeta */
/** @typedef {import("../types.d.ts").AnsiTheme} AnsiTheme */
/** @typedef {import("../types.d.ts").CodefenceRenderers} CodefenceRenderers */

/**
 * @typedef {object} Freeable
 * @property {() => void} free
 */

/**
 * @typedef {Freeable & {
 *   mdToHtml: (markdown: string) => string,
 *   mdToHtmlWithPlugins: (markdown: string, syntaxHighlighter?: Freeable | null, headingAdapter?: Freeable | null) => string,
 *   mdToHtmlWithCodefenceRenderers: (markdown: string, renderers: Freeable, syntaxHighlighter?: Freeable | null, headingAdapter?: Freeable | null) => string,
 *   mdToAnsiWithTheme: (markdown: string, theme: Freeable) => string,
 * }} PreparedOptionsHandle
 */

/**
 * @typedef {object} WasmFacade
 * @property {(input: {module: Uint8Array}) => {memory?: WebAssembly.Memory}} initSync
 * @property {() => string} comrakVersion
 * @property {(markdown: string) => string} healMarkdown
 * @property {(markdown: string, options?: ComrakOptions | null) => string} mdToHtml
 * @property {(markdown: string, options?: ComrakOptions | null, showUrls?: boolean, showMarkdown?: boolean, tableShadow?: string) => string} mdToText
 * @property {(markdown: string, options?: ComrakOptions | null, theme?: AnsiTheme | null) => string} mdToAnsi
 * @property {(markdown: string, options?: ComrakOptions | null, syntaxHighlighter?: Freeable | null, headingAdapter?: Freeable | null) => string} mdToHtmlWithPlugins
 * @property {(markdown: string, options?: ComrakOptions | null, renderers?: CodefenceRenderers | null, syntaxHighlighter?: Freeable | null, headingAdapter?: Freeable | null) => string} mdToHtmlWithCodefenceRenderers
 * @property {new (options?: ComrakOptions | null) => PreparedOptionsHandle} PreparedOptions
 * @property {new (theme?: AnsiTheme | null) => Freeable} PreparedAnsiTheme
 * @property {new (renderers?: CodefenceRenderers | null) => Freeable} PreparedCodefenceRenderers
 * @property {new (highlight: (code: string, language: string) => string, pre: (attributes: Record<string, string>) => string, code: (attributes: Record<string, string>) => string) => Freeable} SyntaxHighlighter
 * @property {new (enter: (heading: HeadingMeta) => string, exit: (heading: HeadingMeta) => string) => Freeable} HeadingAdapter
 */

/**
 * @typedef {object} BenchmarkCase
 * @property {string} name
 * @property {string} input
 * @property {() => string} run
 * @property {number} [iterations]
 * @property {boolean} [captureWasmPages]
 */

/**
 * @typedef {object} BenchmarkResult
 * @property {string} name
 * @property {number} inputBytes
 * @property {number} outputBytes
 * @property {string} outputSha256
 * @property {number} iterations
 * @property {number} medianMicroseconds
 * @property {number} mibPerSecond
 * @property {number} operationsPerSecond
 * @property {number} minimumMicroseconds
 * @property {number} maximumMicroseconds
 * @property {number} [wasmPagesBefore]
 * @property {number} [wasmPagesAfter]
 */

/**
 * @typedef {object} GitMetadata
 * @property {string} sha
 * @property {boolean | null} dirty
 */

let sink = 0;

/**
 * @param {string} name
 * @param {number} fallback
 * @param {boolean} [integer]
 * @returns {number}
 */
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

/**
 * @param {number} size
 * @returns {string}
 */
function makeParagraphSplitInput(size) {
	const unit = `${"a".repeat(78)}\n\n`;
	return (
		unit.repeat(Math.floor(size / unit.length)) +
		unit.slice(0, size % unit.length)
	);
}

/**
 * @param {number} minimumBytes
 * @returns {string}
 */
function makeRepresentativeMarkdown(minimumBytes) {
	/** @type {string[]} */
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

/**
 * @param {number} rowCount
 * @param {number} columnCount
 * @returns {string}
 */
function makeTableInput(rowCount, columnCount) {
	const columns = Array.from(
		{ length: columnCount },
		(_, column) => `column-${column}`,
	);
	const lines = [
		`| ${columns.join(" | ")} |`,
		`| ${columns.map(() => "---").join(" | ")} |`,
	];

	for (let row = 0; row < rowCount; row += 1) {
		lines.push(
			`| ${columns.map((_, column) => `r${row}-c${column}`).join(" | ")} |`,
		);
	}
	return lines.join("\n");
}

/**
 * @param {number} width
 * @param {number} rowCount
 * @returns {string}
 */
function makeSkewedTableInput(width, rowCount) {
	return `| ${"x".repeat(width)} |\n|---|\n${Array.from({ length: rowCount }, () => "| a |").join("\n")}`;
}

/**
 * @param {number} count
 * @returns {string}
 */
function makeFenceInput(count) {
	return Array.from(
		{ length: count },
		(_, index) => `\`\`\`js\nconst value${index} = ${index};\n\`\`\``,
	).join("\n\n");
}

/**
 * @param {number} count
 * @returns {string}
 */
function makeHeadingInput(count) {
	return Array.from(
		{ length: count },
		(_, index) => `${"#".repeat((index % 6) + 1)} Heading ${index}`,
	).join("\n\n");
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
	if (values.length === 0) {
		throw new RangeError("cannot find the median of an empty sample");
	}
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const upper = sorted[middle];
	if (upper === undefined) {
		throw new RangeError("median index is outside the sample");
	}
	if (sorted.length % 2 !== 0) return upper;

	const lower = sorted[middle - 1];
	if (lower === undefined) {
		throw new RangeError("median index is outside the sample");
	}
	return (lower + upper) / 2;
}

/**
 * @param {() => string} run
 * @param {number} iterations
 * @returns {void}
 */
function runBatch(run, iterations) {
	let localSink = 0;
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		localSink = (localSink + run().length) >>> 0;
	}
	sink = Math.imul(sink ^ localSink, 16_777_619) >>> 0;
}

/**
 * @param {WebAssembly.Memory | undefined} memory
 * @returns {number | undefined}
 */
function wasmPages(memory) {
	return memory === undefined
		? undefined
		: memory.buffer.byteLength / WASM_PAGE_BYTES;
}

/**
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

/**
 * @param {BenchmarkCase} benchmarkCase
 * @param {WebAssembly.Memory | undefined} memory
 * @returns {BenchmarkResult}
 */
function benchmark(benchmarkCase, memory) {
	const { name, input, run } = benchmarkCase;
	const inputBytes = Buffer.byteLength(input);
	const iterations =
		benchmarkCase.iterations ??
		Math.max(1, Math.ceil(targetBytesPerSample / inputBytes));
	const wasmPagesBefore = benchmarkCase.captureWasmPages
		? wasmPages(memory)
		: undefined;
	const output = run();
	const wasmPagesAfter = benchmarkCase.captureWasmPages
		? wasmPages(memory)
		: undefined;
	if (typeof output !== "string") {
		throw new TypeError(`${name} returned ${typeof output}, expected a string`);
	}
	const outputBytes = Buffer.byteLength(output);

	for (let warmup = 0; warmup < warmupCount; warmup += 1) {
		runBatch(run, iterations);
	}

	/** @type {number[]} */
	const nanosecondsPerOperation = [];
	for (let sample = 0; sample < sampleCount; sample += 1) {
		const start = process.hrtime.bigint();
		runBatch(run, iterations);
		const elapsedNanoseconds = Number(process.hrtime.bigint() - start);
		nanosecondsPerOperation.push(elapsedNanoseconds / iterations);
	}

	const medianNanoseconds = median(nanosecondsPerOperation);
	/** @type {BenchmarkResult} */
	const result = {
		name,
		inputBytes,
		outputBytes,
		outputSha256: sha256(output),
		iterations,
		medianMicroseconds: medianNanoseconds / 1_000,
		mibPerSecond: inputBytes / MIB / (medianNanoseconds / 1_000_000_000),
		operationsPerSecond: 1_000_000_000 / medianNanoseconds,
		minimumMicroseconds: Math.min(...nanosecondsPerOperation) / 1_000,
		maximumMicroseconds: Math.max(...nanosecondsPerOperation) / 1_000,
	};
	if (wasmPagesBefore !== undefined && wasmPagesAfter !== undefined) {
		result.wasmPagesBefore = wasmPagesBefore;
		result.wasmPagesAfter = wasmPagesAfter;
	}
	return result;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
	if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
	if (bytes >= KIB) return `${(bytes / KIB).toFixed(2)} KiB`;
	return `${bytes} B`;
}

/**
 * @param {BenchmarkResult} result
 * @returns {string}
 */
function formatWasmPages(result) {
	if (
		result.wasmPagesBefore === undefined ||
		result.wasmPagesAfter === undefined
	) {
		return "n/a";
	}
	const delta = result.wasmPagesAfter - result.wasmPagesBefore;
	return `${result.wasmPagesBefore}->${result.wasmPagesAfter} (${delta >= 0 ? "+" : ""}${delta})`;
}

/**
 * @param {BenchmarkResult[]} results
 * @returns {void}
 */
function printResults(results) {
	console.log("");
	console.log(
		"| benchmark | input | output | iterations/sample | median us/op | MiB/s | ops/s | sample range us/op | output sha256 | Wasm pages first run |",
	);
	console.log(
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |",
	);
	for (const result of results) {
		console.log(
			`| ${result.name} | ${formatBytes(result.inputBytes)} | ${formatBytes(result.outputBytes)} | ${result.iterations} | ${result.medianMicroseconds.toFixed(2)} | ${result.mibPerSecond.toFixed(2)} | ${result.operationsPerSecond.toFixed(0)} | ${result.minimumMicroseconds.toFixed(2)}-${result.maximumMicroseconds.toFixed(2)} | ${result.outputSha256} | ${formatWasmPages(result)} |`,
		);
	}
}

/**
 * @param {string[]} arguments_
 * @param {string} cwd
 * @returns {string | undefined}
 */
function gitOutput(arguments_, cwd) {
	try {
		return execFileSync("git", arguments_, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return undefined;
	}
}

/**
 * @param {string} repositoryPath
 * @returns {GitMetadata}
 */
function readGitMetadata(repositoryPath) {
	const sha = gitOutput(["rev-parse", "HEAD"], repositoryPath) ?? "unknown";
	const status = gitOutput(
		["status", "--porcelain", "--untracked-files=normal"],
		repositoryPath,
	);
	return { sha, dirty: status === undefined ? null : status.length > 0 };
}

/**
 * @param {string} cargoToml
 * @returns {string}
 */
function readReleaseProfile(cargoToml) {
	/** @type {string[]} */
	const settings = [];
	let inReleaseProfile = false;
	for (const line of cargoToml.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			if (inReleaseProfile) break;
			inReleaseProfile = trimmed === "[profile.release]";
			continue;
		}
		if (inReleaseProfile && trimmed.length > 0 && !trimmed.startsWith("#")) {
			settings.push(trimmed);
		}
	}
	return settings.length === 0 ? "release" : `release (${settings.join(", ")})`;
}

/**
 * @param {Freeable[]} resources
 * @returns {void}
 */
function disposeResources(resources) {
	for (let index = resources.length - 1; index >= 0; index -= 1) {
		resources[index]?.free();
	}
}

/** @returns {Promise<void>} */
async function main() {
	const repositoryUrl = new URL("../", import.meta.url);
	const repositoryPath = fileURLToPath(repositoryUrl);
	const glueUrl = new URL("index.js", repositoryUrl);
	const wasmUrl = new URL("pkg/comrak.wasm", repositoryUrl);
	const cargoTomlUrl = new URL("Cargo.toml", repositoryUrl);
	const [wasmBytes, cargoToml] = await Promise.all([
		readFile(wasmUrl),
		readFile(cargoTomlUrl, "utf8"),
	]);
	const facade = /** @type {WasmFacade} */ (await import(glueUrl.href));
	const {
		mdToAnsi,
		comrakVersion,
		healMarkdown,
		HeadingAdapter,
		initSync,
		mdToHtml,
		mdToHtmlWithCodefenceRenderers,
		mdToHtmlWithPlugins,
		mdToText,
		PreparedAnsiTheme,
		PreparedCodefenceRenderers,
		PreparedOptions,
		SyntaxHighlighter,
	} = facade;

	const initialized = initSync({ module: wasmBytes });
	const wasmMemory = initialized.memory;
	const representativeMarkdown = makeRepresentativeMarkdown(16 * KIB);
	/** @type {ComrakOptions} */
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
	const syntaxHeavy = "a~".repeat((64 * KIB) / 2);
	const syntaxHeavySmall = "a~".repeat((8 * KIB) / 2);
	const bracketHeavy = "[a".repeat((256 * KIB) / 2);
	const bracketHeavySmall = "[a".repeat((64 * KIB) / 2);
	const largeTable = makeTableInput(1_000, 10);
	const skewedTable = makeSkewedTableInput(1_024, 1_024);
	const tinyMarkdown = "# Tiny\n\ntext";
	const largePlainMarkdown = "a".repeat(256 * KIB);
	const fences = makeFenceInput(1_000);
	const headings = makeHeadingInput(1_000);
	const tableResult = benchmark(
		{
			name: "mdToText/table/1000x10",
			input: largeTable,
			iterations: LARGE_CASE_ITERATIONS,
			captureWasmPages: true,
			run: () =>
				mdToText(largeTable, { extension: { table: true } }, false, false, ""),
		},
		wasmMemory,
	);
	const preparedOptions = new PreparedOptions(representativeOptions);
	/** @type {AnsiTheme} */
	const emptyAnsiThemeOptions = {
		heading: "",
		headingH1: "",
		headingH2: "",
		headingH3: "",
		headingH4: "",
		headingH5: "",
		headingH6: "",
		bold: "",
		italic: "",
		strikethrough: "",
		underline: "",
		code: "",
		codeBlock: "",
		codeBlockBorder: "",
		link: "",
		linkUrl: "",
		blockquote: "",
		blockquoteBorder: "",
		thematicBreak: "",
		listBullet: "",
		math: "",
		reset: "",
		showUrls: false,
		showMarkdown: false,
		tableShadow: "",
		hyperlinks: false,
	};
	const preparedAnsiTheme = new PreparedAnsiTheme(emptyAnsiThemeOptions);
	/** @type {CodefenceRenderers} */
	const rendererMap = Object.fromEntries(
		Array.from({ length: 100 }, (_, index) => [
			`language-${index}`,
			(_language, _meta, code) => code,
		]),
	);
	const preparedRenderers = new PreparedCodefenceRenderers(rendererMap);
	const syntaxHighlighter = new SyntaxHighlighter(
		(code, language) => `<mark data-language="${language}">${code}</mark>`,
		() => "<pre>",
		() => "<code>",
	);
	const headingAdapter = new HeadingAdapter(
		(heading) => `<h${heading.level} data-content="${heading.content}">`,
		(heading) => `</h${heading.level}>`,
	);
	/** @type {Freeable[]} */
	const resources = [
		preparedOptions,
		preparedAnsiTheme,
		preparedRenderers,
		syntaxHighlighter,
		headingAdapter,
	];

	/** @type {BenchmarkCase[]} */
	const cases = [];
	for (const [label, size] of /** @type {const} */ ([
		["1KiB", 1 * KIB],
		["16KiB", 16 * KIB],
		["256KiB", 256 * KIB],
	])) {
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
			name: "heal/syntax-heavy/8KiB",
			input: syntaxHeavySmall,
			run: () => healMarkdown(syntaxHeavySmall),
		},
		{
			name: "heal/syntax-heavy/64KiB",
			input: syntaxHeavy,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => healMarkdown(syntaxHeavy),
		},
		{
			name: "heal/bracket-heavy/64KiB",
			input: bracketHeavySmall,
			run: () => healMarkdown(bracketHeavySmall),
		},
		{
			name: "heal/bracket-heavy/256KiB",
			input: bracketHeavy,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => healMarkdown(bracketHeavy),
		},
		{
			name: "mdToHtml/tiny/no-options",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () => mdToHtml(tinyMarkdown),
		},
		{
			name: "mdToHtml/tiny/populated-options",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () => mdToHtml(tinyMarkdown, representativeOptions),
		},
		{
			name: "mdToHtml/tiny/prepared-options",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () => preparedOptions.mdToHtml(tinyMarkdown),
		},
		{
			name: "mdToHtml/tiny/plugin-options/raw",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				mdToHtmlWithPlugins(
					tinyMarkdown,
					representativeOptions,
					syntaxHighlighter,
				),
		},
		{
			name: "mdToHtml/tiny/plugin-options/prepared",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				preparedOptions.mdToHtmlWithPlugins(tinyMarkdown, syntaxHighlighter),
		},
		{
			name: "mdToHtml/tiny/100-renderers/raw",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				mdToHtmlWithCodefenceRenderers(
					tinyMarkdown,
					representativeOptions,
					rendererMap,
				),
		},
		{
			name: "mdToHtml/tiny/100-renderers/prepared",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				preparedOptions.mdToHtmlWithCodefenceRenderers(
					tinyMarkdown,
					preparedRenderers,
				),
		},
		{
			name: "mdToAnsi/tiny/raw-theme",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				mdToAnsi(tinyMarkdown, representativeOptions, emptyAnsiThemeOptions),
		},
		{
			name: "mdToAnsi/tiny/prepared-theme-options",
			input: tinyMarkdown,
			iterations: TINY_CASE_ITERATIONS,
			run: () =>
				preparedOptions.mdToAnsiWithTheme(tinyMarkdown, preparedAnsiTheme),
		},
		{
			name: "mdToText/table/skewed-1024x1",
			input: skewedTable,
			iterations: LARGE_CASE_ITERATIONS,
			run: () =>
				mdToText(skewedTable, { extension: { table: true } }, false, false, ""),
		},
		{
			name: "mdToText/plain/256KiB",
			input: largePlainMarkdown,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => mdToText(largePlainMarkdown, undefined, false, false, ""),
		},
		{
			name: "mdToAnsi/plain/256KiB/raw-theme",
			input: largePlainMarkdown,
			iterations: LARGE_CASE_ITERATIONS,
			run: () =>
				mdToAnsi(
					largePlainMarkdown,
					representativeOptions,
					emptyAnsiThemeOptions,
				),
		},
		{
			name: "mdToAnsi/plain/256KiB/prepared-theme-options",
			input: largePlainMarkdown,
			iterations: LARGE_CASE_ITERATIONS,
			run: () =>
				preparedOptions.mdToAnsiWithTheme(
					largePlainMarkdown,
					preparedAnsiTheme,
				),
		},
		{
			name: "mdToHtml/1000-fences/base",
			input: fences,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => mdToHtml(fences),
		},
		{
			name: "mdToHtml/1000-fences/plugin",
			input: fences,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => mdToHtmlWithPlugins(fences, undefined, syntaxHighlighter),
		},
		{
			name: "mdToHtml/1000-headings/base",
			input: headings,
			iterations: LARGE_CASE_ITERATIONS,
			run: () => mdToHtml(headings),
		},
		{
			name: "mdToHtml/1000-headings/plugin",
			input: headings,
			iterations: LARGE_CASE_ITERATIONS,
			run: () =>
				mdToHtmlWithPlugins(headings, undefined, undefined, headingAdapter),
		},
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

	const results = [tableResult];
	try {
		results.push(
			...cases.map((benchmarkCase) => benchmark(benchmarkCase, wasmMemory)),
		);
	} finally {
		disposeResources(resources);
	}

	const cpu = cpus()[0];
	const wasmHash = createHash("sha256").update(wasmBytes).digest("hex");
	const git = readGitMetadata(repositoryPath);
	const releaseProfile = readReleaseProfile(cargoToml);
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
		`git: ${git.sha}${git.dirty === null ? "; dirty state unavailable" : git.dirty ? "; dirty" : "; clean"}`,
	);
	console.log(`release profile: ${releaseProfile}`);
	console.log(
		`config: ${warmupCount} warmup(s), ${sampleCount} sample(s), ${formatBytes(targetBytesPerSample)} input/sample target`,
	);

	printResults(results);
	console.log(`\nchecksum: ${sink}`);

	if (process.env[JSON_OUTPUT_ENV] === "1") {
		console.log("\nJSON:");
		console.log(
			JSON.stringify(
				{
					comrak: comrakVersion(),
					node: process.version,
					platform: `${platform()} ${release()} ${arch()}`,
					gitSha: git.sha,
					gitDirty: git.dirty,
					releaseProfile,
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

/**
 * @param {unknown} error
 * @returns {void}
 */
function reportFailure(error) {
	console.error(
		"Unable to run the Wasm benchmark. Build the package with `pnpm run build` first.",
	);
	console.error(error);
	process.exitCode = 1;
}

main().catch(reportFailure);
