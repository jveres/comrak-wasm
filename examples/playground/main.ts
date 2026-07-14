import init, {
	ansiThemeDark,
	ansiThemeLight,
	healMarkdown,
	mdToAnsi,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithPlugins,
	mdToText,
	mdToXml,
	SyntaxHighlighter,
} from "comrak-wasm";
import type { ComrakOptions } from "../../types";
import { createPlaygroundOptions } from "../shared/options.js";
import sampleMarkdown from "./sample.md?raw";

const input = document.getElementById("input") as HTMLTextAreaElement;
const output = document.getElementById("output") as HTMLDivElement;
const outputLabel = document.getElementById("output-label") as HTMLDivElement;
const formatSelect = document.getElementById("format") as HTMLSelectElement;
const healCheck = document.getElementById("heal") as HTMLInputElement;
const rawHtmlSelect = document.getElementById("rawHtml") as HTMLSelectElement;
const extensionsCheck = document.getElementById(
	"extensions",
) as HTMLInputElement;
const wikilinkModeSelect = document.getElementById(
	"wikilinkMode",
) as HTMLSelectElement;
const shikiCheck = document.getElementById("shiki") as HTMLInputElement;
const katexCheck = document.getElementById("katex") as HTMLInputElement;
const themeSelect = document.getElementById("theme") as HTMLSelectElement;
const showMarkdownCheck = document.getElementById(
	"showMarkdown",
) as HTMLInputElement;
const showUrlsCheck = document.getElementById("showUrls") as HTMLInputElement;
const tableShadowCheck = document.getElementById(
	"tableShadow",
) as HTMLInputElement;
const formatOptions = document.getElementById(
	"formatOptions",
) as HTMLDivElement;
const status = document.getElementById("status") as HTMLSpanElement;

input.value = sampleMarkdown;

let ready = false;
let shikiModulePromise: Promise<typeof import("./shiki-renderer")> | null =
	null;
let katexModulePromise: Promise<typeof import("./katex-renderer")> | null =
	null;
const reportedOptionalFailures = new Set<string>();

type OptionalLoadResult<T> =
	| { readonly state: "skipped" }
	| { readonly state: "loaded"; readonly value: T }
	| { readonly state: "failed"; readonly error: unknown };

async function loadOptional<T>(
	enabled: boolean,
	load: () => Promise<T>,
): Promise<OptionalLoadResult<T>> {
	if (!enabled) return { state: "skipped" };
	try {
		return { state: "loaded", value: await load() };
	} catch (error) {
		return { state: "failed", error };
	}
}

function loadSyntaxHighlighter(dark: boolean): Promise<SyntaxHighlighter> {
	shikiModulePromise ??= import("./shiki-renderer");
	return shikiModulePromise.then((module) =>
		module.getSyntaxHighlighter(SyntaxHighlighter, dark),
	);
}

function loadKatexRenderer(): Promise<typeof import("./katex-renderer")> {
	katexModulePromise ??= import("./katex-renderer");
	return katexModulePromise;
}

function reportOptionalFailure(name: string, error: unknown): void {
	if (reportedOptionalFailures.has(name)) return;
	reportedOptionalFailures.add(name);
	console.error(`Failed to load optional ${name} renderer:`, error);
}

function getOptions(): ComrakOptions {
	return createPlaygroundOptions(
		extensionsCheck.checked,
		rawHtmlSelect.value,
		wikilinkModeSelect.value,
	);
}

function isDark(): boolean {
	const v = themeSelect.value;
	if (v === "dark") return true;
	if (v === "light") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(dark: boolean): void {
	document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function ansiToHtml(text: string): string {
	// State-based renderer: tracks all active SGR attributes and rebuilds
	// a single <span> on each SGR change. Handles 256-color (38;5;N / 48;5;N),
	// targeted resets (22/23/24/29/39/49), and standard SGR codes.
	let bold = false;
	let dim = false;
	let italic = false;
	let underline = false;
	let strike = false;
	let fg = "";
	let bg = "";
	let bgPad = false; // true for standard bg colors (alerts), false for 256-color bg (inline code)
	let spanOpen = false;

	const fgMap: Record<number, string> = {
		30: "#636c76",
		31: "#f85149",
		32: "#3fb950",
		33: "#d29922",
		34: "#58a6ff",
		35: "#bc8cff",
		36: "#39c5cf",
		37: "#b1bac4",
		90: "#636c76",
		91: "#ff7b72",
		92: "#7ee787",
		93: "#e3b341",
		94: "#79c0ff",
		95: "#d2a8ff",
		96: "#56d4dd",
		97: "#f0f6fc",
	};
	const bgMap: Record<number, string> = {
		41: "#f85149",
		42: "#3fb950",
		43: "#d29922",
		44: "#58a6ff",
		45: "#bc8cff",
		47: "#d0d7de",
	};

	function color256(n: number): string {
		const std = [
			"#000",
			"#800000",
			"#008000",
			"#808000",
			"#000080",
			"#800080",
			"#008080",
			"#c0c0c0",
			"#808080",
			"#f00",
			"#0f0",
			"#ff0",
			"#00f",
			"#f0f",
			"#0ff",
			"#fff",
		];
		if (n < 16) return std[n] ?? "";
		if (n < 232) {
			const i = n - 16;
			const r = Math.floor(i / 36) * 51;
			const g = Math.floor((i % 36) / 6) * 51;
			const b = (i % 6) * 51;
			return `rgb(${r},${g},${b})`;
		}
		const v = (n - 232) * 10 + 8;
		return `rgb(${v},${v},${v})`;
	}

	function emitSpan(out: string[]): void {
		if (spanOpen) {
			out.push("</span>");
			spanOpen = false;
		}
		const s: string[] = [];
		if (bold) s.push("font-weight:bold");
		if (dim) s.push("opacity:0.6");
		if (italic) s.push("font-style:italic");
		const deco: string[] = [];
		if (underline) deco.push("underline");
		if (strike) deco.push("line-through");
		if (deco.length) s.push(`text-decoration:${deco.join(" ")}`);
		if (fg) s.push(`color:${fg}`);
		if (bg && bgPad) s.push(`background:${bg};padding:1px 4px`);
		else if (bg) s.push(`background:${bg};border-radius:3px`);
		if (s.length) {
			out.push(`<span style="${s.join(";")}">`);
			spanOpen = true;
		}
	}

	function processSGR(codes: number[], out: string[]): void {
		let j = 0;
		while (j < codes.length) {
			const c = codes[j];
			const extendedColor = codes[j + 2];
			if (c === undefined) {
				j++;
				continue;
			}
			if (c === 0) {
				bold = dim = italic = underline = strike = false;
				fg = bg = "";
				bgPad = false;
			} else if (c === 1) bold = true;
			else if (c === 2) dim = true;
			else if (c === 3) italic = true;
			else if (c === 4) underline = true;
			else if (c === 9) strike = true;
			else if (c === 22) {
				bold = false;
				dim = false;
			} else if (c === 23) italic = false;
			else if (c === 24) underline = false;
			else if (c === 29) strike = false;
			else if (c === 39) fg = "";
			else if (c === 49) {
				bg = "";
				bgPad = false;
			} else if (c >= 30 && c <= 37) fg = fgMap[c] ?? "";
			else if (c >= 90 && c <= 97) fg = fgMap[c] ?? "";
			else if (c >= 40 && c <= 47) {
				bg = bgMap[c] ?? "";
				bgPad = true;
			} else if (
				c === 38 &&
				codes[j + 1] === 5 &&
				extendedColor !== undefined
			) {
				fg = color256(extendedColor);
				j += 2;
			} else if (
				c === 48 &&
				codes[j + 1] === 5 &&
				extendedColor !== undefined
			) {
				bg = color256(extendedColor);
				bgPad = false;
				j += 2;
			}
			j++;
		}
		emitSpan(out);
	}

	const out: string[] = [];
	let i = 0;
	while (i < text.length) {
		// SGR: \x1b[...m
		if (text[i] === "\x1b" && text[i + 1] === "[") {
			const end = text.indexOf("m", i + 2);
			if (end !== -1) {
				const codes = text
					.slice(i + 2, end)
					.split(";")
					.map(Number);
				processSGR(codes, out);
				i = end + 1;
				continue;
			}
		}
		// OSC 8 hyperlinks: \x1b]8;;url\x1b\ — skip the sequence
		if (text[i] === "\x1b" && text[i + 1] === "]") {
			const st = text.indexOf("\x1b\\", i + 2);
			if (st !== -1) {
				i = st + 2;
				continue;
			}
		}
		if (text[i] === "<") out.push("&lt;");
		else if (text[i] === ">") out.push("&gt;");
		else if (text[i] === "&") out.push("&amp;");
		else if (text[i] === "\n") out.push("<br>");
		else out.push(text[i] ?? "");
		i++;
	}
	if (spanOpen) out.push("</span>");
	return out.join("");
}

function updateFormatOptions(): void {
	const format = formatSelect.value;
	formatOptions.style.display =
		format === "ansi" || format === "text" ? "flex" : "none";
}

async function render(requestId: number): Promise<void> {
	if (!ready || requestId !== renderRequestId) return;

	const format = formatSelect.value;
	const dark = isDark();
	applyTheme(dark);
	updateFormatOptions();

	const useShiki =
		shikiCheck.checked && (format === "preview" || format === "html");
	const useKatex = katexCheck.checked && format === "preview";
	const loading = [useShiki ? "Shiki" : "", useKatex ? "KaTeX" : ""].filter(
		Boolean,
	);
	if (loading.length > 0) {
		status.textContent = `Loading ${loading.join(" and ")}...`;
	}

	const [shikiResult, katexResult] = await Promise.all([
		loadOptional(useShiki, () => loadSyntaxHighlighter(dark)),
		loadOptional(useKatex, loadKatexRenderer),
	]);
	if (requestId !== renderRequestId) return;

	const failures: string[] = [];
	if (shikiResult.state === "failed") {
		failures.push("Shiki");
		reportOptionalFailure("Shiki", shikiResult.error);
	}
	if (katexResult.state === "failed") {
		failures.push("KaTeX");
		reportOptionalFailure("KaTeX", katexResult.error);
	}

	const md = healCheck.checked ? healMarkdown(input.value) : input.value;
	const opts = getOptions();
	const t0 = performance.now();
	const syntaxHighlighter =
		shikiResult.state === "loaded" ? shikiResult.value : null;

	let result: string;
	output.style.background = "";
	output.style.color = "";

	switch (format) {
		case "preview": {
			result = syntaxHighlighter
				? mdToHtmlWithPlugins(md, opts, syntaxHighlighter)
				: mdToHtml(md, opts);
			output.className = "preview";
			output.innerHTML = result;
			if (katexResult.state === "loaded") {
				katexResult.value.renderMath(output);
			}
			outputLabel.textContent = "HTML (preview)";
			break;
		}
		case "html": {
			result = syntaxHighlighter
				? mdToHtmlWithPlugins(md, opts, syntaxHighlighter)
				: mdToHtml(md, opts);
			output.className = "source";
			output.textContent = result;
			outputLabel.textContent = "HTML (source)";
			break;
		}
		case "commonmark":
			result = mdToCommonmark(md, opts);
			output.className = "source";
			output.textContent = result;
			outputLabel.textContent = "CommonMark";
			break;
		case "xml":
			result = mdToXml(md, opts);
			output.className = "source";
			output.textContent = result;
			outputLabel.textContent = "XML";
			break;
		case "text":
			result = mdToText(
				md,
				opts,
				showUrlsCheck.checked,
				showMarkdownCheck.checked,
				tableShadowCheck.checked ? "░" : "",
			);
			output.className = "source";
			output.textContent = result;
			outputLabel.textContent = "Text";
			break;
		case "ansi": {
			const theme = dark ? ansiThemeDark() : ansiThemeLight();
			theme.showMarkdown = showMarkdownCheck.checked;
			theme.showUrls = showUrlsCheck.checked;
			theme.tableShadow = tableShadowCheck.checked ? "░" : "";
			result = mdToAnsi(md, opts, theme);
			output.className = "ansi";
			if (dark) {
				output.style.background = "#1e1e1e";
				output.style.color = "#d4d4d4";
			} else {
				output.style.background = "#ffffff";
				output.style.color = "#1f2328";
			}
			output.innerHTML = ansiToHtml(result);
			outputLabel.textContent = "ANSI";
			break;
		}
		default:
			return;
	}

	const ms = (performance.now() - t0).toFixed(1);
	const warning =
		failures.length > 0 ? ` · ${failures.join(" and ")} unavailable` : "";
	status.textContent = `Rendered in ${ms}ms${warning}`;
}

let renderTimer: number | undefined;
let renderRequestId = 0;

function scheduleRender(): void {
	window.clearTimeout(renderTimer);
	const requestId = ++renderRequestId;
	renderTimer = window.setTimeout(() => void render(requestId), 75);
}

function renderNow(): void {
	window.clearTimeout(renderTimer);
	const requestId = ++renderRequestId;
	void render(requestId);
}

input.addEventListener("input", scheduleRender);
formatSelect.addEventListener("change", renderNow);
healCheck.addEventListener("change", renderNow);
rawHtmlSelect.addEventListener("change", renderNow);
extensionsCheck.addEventListener("change", renderNow);
wikilinkModeSelect.addEventListener("change", renderNow);
shikiCheck.addEventListener("change", renderNow);
katexCheck.addEventListener("change", renderNow);
themeSelect.addEventListener("change", renderNow);
showMarkdownCheck.addEventListener("change", renderNow);
showUrlsCheck.addEventListener("change", renderNow);
tableShadowCheck.addEventListener("change", renderNow);
window
	.matchMedia("(prefers-color-scheme: dark)")
	.addEventListener("change", renderNow);

window.addEventListener("pagehide", () => {
	window.clearTimeout(renderTimer);
	renderRequestId++;

	const shikiModule = shikiModulePromise;
	shikiModulePromise = null;
	katexModulePromise = null;
	if (shikiModule) {
		void shikiModule
			.then((module) => module.releaseShiki())
			.catch(() => undefined);
	}
});

window.addEventListener("pageshow", (event) => {
	if (event.persisted) renderNow();
});

// Handle anchor clicks within the output pane (e.g., footnotes)
output.addEventListener("click", (e) => {
	const link = (e.target as HTMLElement).closest("a[href^='#']");
	if (!link) return;
	e.preventDefault();
	const id = link.getAttribute("href")?.slice(1);
	if (!id) return;
	const target = output.querySelector(`[id="${id}"]`) as HTMLElement | null;
	if (target) {
		output.scrollTop = target.offsetTop - output.offsetTop;
	}
});

async function initialize(): Promise<void> {
	try {
		await init();
		ready = true;
		status.textContent = "Ready";
		renderNow();
	} catch (error) {
		console.error("Failed to initialize comrak-wasm playground:", error);
		status.textContent = "Failed to load — see console";
	}
}

void initialize();
