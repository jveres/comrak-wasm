import init, {
	ansiThemeDark,
	ansiThemeLight,
	ansiToHtml,
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
			// ansiToHtml escapes the text; index.html styles its ansi-* classes.
			output.innerHTML = ansiToHtml(result).html;
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
