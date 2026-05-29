import katex from "katex";
import "katex/contrib/mhchem";
import { createHighlighter, type Highlighter } from "shiki";
import init, {
	ansiThemeDark,
	ansiThemeLight,
	comrakVersion,
	healMarkdown,
	mdToAnsi,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithPlugins,
	mdToText,
	mdToXml,
	SyntaxHighlighter,
} from "../../pkg/comrak.js";

const input = document.getElementById("input") as HTMLTextAreaElement;
const output = document.getElementById("output") as HTMLDivElement;
const outputLabel = document.getElementById("output-label") as HTMLDivElement;
const formatSelect = document.getElementById("format") as HTMLSelectElement;
const healCheck = document.getElementById("heal") as HTMLInputElement;
const unsafeCheck = document.getElementById("unsafe") as HTMLInputElement;
const gfmCheck = document.getElementById("gfm") as HTMLInputElement;
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
const version = document.getElementById("version") as HTMLSpanElement;

let shiki: Highlighter | null = null;

const [, highlighter] = await Promise.all([
	init(),
	createHighlighter({
		themes: ["github-dark", "github-light"],
		langs: [
			"typescript",
			"javascript",
			"rust",
			"bash",
			"json",
			"html",
			"css",
			"python",
			"go",
			"yaml",
			"toml",
			"markdown",
		],
	}),
]);

shiki = highlighter;
version.textContent = `comrak ${comrakVersion()}`;
status.textContent = "Ready";

function getOptions() {
	const opts: Record<string, unknown> = {
		render: { unsafe: unsafeCheck.checked },
	};
	if (gfmCheck.checked) {
		opts.extension = {
			strikethrough: true,
			table: true,
			tasklist: true,
			autolink: true,
			headerIds: "",
			frontMatterDelimiter: "---",
			alerts: true,
			footnotes: true,
			inlineFootnotes: true,
			mathDollars: true,
			mathCode: true,
			superscript: true,
			subscript: true,
			underline: true,
			spoiler: true,
			highlight: true,
			insert: true,
			descriptionLists: true,
			multilineBlockQuotes: true,
			wikilinksTitleAfterPipe: true,
			shortcodes: true,
		};
	}
	return opts;
}

function isDark(): boolean {
	const v = themeSelect.value;
	if (v === "dark") return true;
	if (v === "light") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
	document.documentElement.setAttribute(
		"data-theme",
		isDark() ? "dark" : "light",
	);
}

const shikiThemes = {
	dark: { name: "github-dark", bg: "#24292e", fg: "#e1e4e8" },
	light: { name: "github-light", bg: "#ffffff", fg: "#1f2328" },
};

function createHighlighterAdapter(): SyntaxHighlighter | null {
	if (!shikiCheck.checked || !shiki) return null;
	const t = isDark() ? shikiThemes.dark : shikiThemes.light;
	return new SyntaxHighlighter(
		(code: string, lang: string | undefined) => {
			if (!lang || !shiki) return code;
			try {
				const highlighted = shiki.codeToHtml(code, {
					lang,
					theme: t.name,
				});
				const match = highlighted.match(
					/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/,
				);
				return match?.[1] ?? code;
			} catch {
				return code;
			}
		},
		(attrs: Record<string, string>) => {
			const cls = attrs.class ? ` ${attrs.class}` : "";
			return `<pre class="shiki ${t.name}${cls}" style="background-color:${t.bg};color:${t.fg};padding:1em;border-radius:6px;overflow-x:auto">`;
		},
		(attrs: Record<string, string>) => {
			const cls = attrs.class ? ` class="${attrs.class}"` : "";
			return `<code${cls}>`;
		},
	);
}

function renderMath(container: HTMLElement) {
	if (!katexCheck.checked) return;
	container.querySelectorAll("[data-math-style]").forEach((el) => {
		const display = el.getAttribute("data-math-style") === "display";
		katex.render(el.textContent ?? "", el as HTMLElement, {
			displayMode: display,
			throwOnError: false,
		});
	});
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
		30: "#636c76", 31: "#f85149", 32: "#3fb950", 33: "#d29922",
		34: "#58a6ff", 35: "#bc8cff", 36: "#39c5cf", 37: "#b1bac4",
		90: "#636c76", 91: "#ff7b72", 92: "#7ee787", 93: "#e3b341",
		94: "#79c0ff", 95: "#d2a8ff", 96: "#56d4dd", 97: "#f0f6fc",
	};
	const bgMap: Record<number, string> = {
		41: "#f85149", 42: "#3fb950", 43: "#d29922",
		44: "#58a6ff", 45: "#bc8cff", 47: "#d0d7de",
	};

	function color256(n: number): string {
		const std = [
			"#000","#800000","#008000","#808000","#000080","#800080","#008080","#c0c0c0",
			"#808080","#f00","#0f0","#ff0","#00f","#f0f","#0ff","#fff",
		];
		if (n < 16) return std[n];
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
		if (spanOpen) { out.push("</span>"); spanOpen = false; }
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
		if (s.length) { out.push(`<span style="${s.join(";")}">`); spanOpen = true; }
	}

	function processSGR(codes: number[], out: string[]): void {
		let j = 0;
		while (j < codes.length) {
			const c = codes[j];
			if (c === 0) { bold = dim = italic = underline = strike = false; fg = bg = ""; bgPad = false; }
			else if (c === 1) bold = true;
			else if (c === 2) dim = true;
			else if (c === 3) italic = true;
			else if (c === 4) underline = true;
			else if (c === 9) strike = true;
			else if (c === 22) { bold = false; dim = false; }
			else if (c === 23) italic = false;
			else if (c === 24) underline = false;
			else if (c === 29) strike = false;
			else if (c === 39) fg = "";
			else if (c === 49) { bg = ""; bgPad = false; }
			else if (c >= 30 && c <= 37) fg = fgMap[c] ?? "";
			else if (c >= 90 && c <= 97) fg = fgMap[c] ?? "";
			else if (c >= 40 && c <= 47) { bg = bgMap[c] ?? ""; bgPad = true; }
			else if (c === 38 && codes[j + 1] === 5 && j + 2 < codes.length) { fg = color256(codes[j + 2]); j += 2; }
			else if (c === 48 && codes[j + 1] === 5 && j + 2 < codes.length) { bg = color256(codes[j + 2]); bgPad = false; j += 2; }
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
				const codes = text.slice(i + 2, end).split(";").map(Number);
				processSGR(codes, out);
				i = end + 1;
				continue;
			}
		}
		// OSC 8 hyperlinks: \x1b]8;;url\x1b\ — skip the sequence
		if (text[i] === "\x1b" && text[i + 1] === "]") {
			const st = text.indexOf("\x1b\\", i + 2);
			if (st !== -1) { i = st + 2; continue; }
		}
		if (text[i] === "<") out.push("&lt;");
		else if (text[i] === ">") out.push("&gt;");
		else if (text[i] === "&") out.push("&amp;");
		else if (text[i] === "\n") out.push("<br>");
		else out.push(text[i]);
		i++;
	}
	if (spanOpen) out.push("</span>");
	return out.join("");
}

function updateFormatOptions() {
	const format = formatSelect.value;
	formatOptions.style.display =
		format === "ansi" || format === "text" ? "flex" : "none";
}

function render() {
	applyTheme();
	updateFormatOptions();
	const md = healCheck.checked ? healMarkdown(input.value) : input.value;
	const format = formatSelect.value;
	const opts = getOptions();
	const t0 = performance.now();

	let result: string;
	output.style.background = "";
	output.style.color = "";

	switch (format) {
		case "preview": {
			const sh = createHighlighterAdapter();
			result = sh ? mdToHtmlWithPlugins(md, opts, sh) : mdToHtml(md, opts);
			output.className = "preview";
			output.innerHTML = result;
			renderMath(output);
			outputLabel.textContent = "HTML (preview)";
			break;
		}
		case "html": {
			const sh = createHighlighterAdapter();
			result = sh ? mdToHtmlWithPlugins(md, opts, sh) : mdToHtml(md, opts);
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
			const dark = isDark();
			const theme = dark ? ansiThemeDark() : ansiThemeLight();
			theme.showMarkdown = showMarkdownCheck.checked;
			theme.showUrls = showUrlsCheck.checked;
			theme.tableShadow = tableShadowCheck.checked ? "░" : undefined;
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
	status.textContent = `Rendered in ${ms}ms`;
}

input.addEventListener("input", render);
formatSelect.addEventListener("change", render);
healCheck.addEventListener("change", render);
unsafeCheck.addEventListener("change", render);
gfmCheck.addEventListener("change", render);
shikiCheck.addEventListener("change", render);
katexCheck.addEventListener("change", render);
themeSelect.addEventListener("change", render);
showMarkdownCheck.addEventListener("change", render);
showUrlsCheck.addEventListener("change", render);
tableShadowCheck.addEventListener("change", render);
window
	.matchMedia("(prefers-color-scheme: dark)")
	.addEventListener("change", render);

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

render();
