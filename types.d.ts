/// <reference lib="dom" />

export interface ExtensionOptions {
	strikethrough?: boolean;
	tagfilter?: boolean;
	table?: boolean;
	autolink?: boolean;
	tasklist?: boolean;
	superscript?: boolean;
	/**
	 * Enables heading `id` attributes, using this string as the id prefix.
	 * Pass `""` to enable ids with no prefix.
	 * @deprecated Use headerIdPrefix instead
	 */
	headerIds?: string;
	/** Heading `id` prefix; `""` enables ids with no prefix. */
	headerIdPrefix?: string;
	headerIdPrefixInHref?: boolean;
	footnotes?: boolean;
	inlineFootnotes?: boolean;
	descriptionLists?: boolean;
	frontMatterDelimiter?: string;
	multilineBlockQuotes?: boolean;
	alerts?: boolean;
	mathDollars?: boolean;
	/** Enables inline `\\(...\\)` and display `\\[...\\]` math. */
	mathLatex?: boolean;
	mathCode?: boolean;
	shortcodes?: boolean;
	wikilinksTitleAfterPipe?: boolean;
	wikilinksTitleBeforePipe?: boolean;
	underline?: boolean;
	subscript?: boolean;
	spoiler?: boolean;
	greentext?: boolean;
	cjkFriendlyEmphasis?: boolean;
	subtext?: boolean;
	highlight?: boolean;
	insert?: boolean;
	/**
	 * Enables trusted Phoenix HEEx template syntax. HEEx output bypasses raw HTML
	 * omit, escape, and tag-filter settings.
	 */
	phoenixHeex?: boolean;
	/** Enables `:::` container block directives. */
	blockDirective?: boolean;
	/**
	 * Parses attributes attached to ATX and setext headings. Stock formatters
	 * consume the syntax but do not expose or render the parsed attributes.
	 */
	headerAttributes?: boolean;
	/**
	 * Parses attributes in fenced code block info strings. Stock formatters
	 * consume the syntax but do not expose or render the parsed attributes.
	 */
	fencedCodeAttributes?: boolean;
	/**
	 * Parses attributes following inline code spans. Stock formatters consume
	 * the syntax but do not expose or render the parsed attributes.
	 */
	inlineCodeAttributes?: boolean;
	/**
	 * Parses attributes following links and images. Stock formatters consume the
	 * syntax but do not expose or render the parsed attributes.
	 */
	linkAttributes?: boolean;
}

export interface ParseOptions {
	smart?: boolean;
	defaultInfoString?: string;
	relaxedTasklistMatching?: boolean;
	tasklistInTable?: boolean;
	relaxedAutolinks?: boolean;
	ignoreSetext?: boolean;
	leaveFootnoteDefinitions?: boolean;
	escapedCharSpans?: boolean;
	/** Counts source-position columns as Unicode characters instead of UTF-8 bytes. */
	sourceposChars?: boolean;
}

export interface RenderOptions {
	hardbreaks?: boolean;
	githubPreLang?: boolean;
	fullInfoString?: boolean;
	width?: number;
	unsafe?: boolean;
	escape?: boolean;
	listStyle?: "dash" | "plus" | "star";
	sourcepos?: boolean;
	escapedCharSpans?: boolean;
	ignoreEmptyLinks?: boolean;
	gfmQuirks?: boolean;
	preferFenced?: boolean;
	figureWithCaption?: boolean;
	tasklistClasses?: boolean;
	/** Selects comrak's class-based or semantic HTML alert markup. */
	alertStyle?: "specific" | "semantic";
	olWidth?: number;
	experimentalMinimizeCommonmark?: boolean;
	compactHtml?: boolean;
}

export interface ComrakOptions {
	extension?: ExtensionOptions;
	parse?: ParseOptions;
	render?: RenderOptions;
}

export function comrakVersion(): string;
export function mdToHtml(md: string, options?: ComrakOptions | null): string;
export function mdToCommonmark(
	md: string,
	options?: ComrakOptions | null,
): string;

export type SyntaxHighlightCallback = (
	code: string,
	lang: string | undefined,
) => string;

export type AttributeRendererCallback = (
	attributes: Record<string, string>,
) => string;

export interface HeadingMeta {
	level: number;
	content: string;
}

export type HeadingAdapterCallback = (heading: HeadingMeta) => string;

export class SyntaxHighlighter {
	constructor(
		highlight: SyntaxHighlightCallback,
		pre: AttributeRendererCallback,
		code: AttributeRendererCallback,
	);
	/** Creates a new adapter backed by the same callbacks. */
	clone(): SyntaxHighlighter;
	free(): void;
}

export class HeadingAdapter {
	constructor(enter: HeadingAdapterCallback, exit: HeadingAdapterCallback);
	/** Creates a new adapter backed by the same callbacks. */
	clone(): HeadingAdapter;
	free(): void;
}

export function mdToHtmlWithPlugins(
	md: string,
	options?: ComrakOptions | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

export function mdToXml(md: string, options?: ComrakOptions | null): string;

/**
 * @deprecated Comrak's XML formatter ignores render plugins. Use mdToXml.
 */
export function mdToXmlWithPlugins(
	md: string,
	options?: ComrakOptions | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

export type CodefenceRendererCallback = (
	lang: string,
	meta: string,
	code: string,
) => string;

export type CodefenceRenderers = Record<string, CodefenceRendererCallback>;

/**
 * Low-level renderer wrapper exported by the WASM module. Most callers don't
 * construct this directly — pass a plain
 * `{ [lang]: (lang, meta, code) => string }` object as the `renderers` argument
 * of {@link mdToHtmlWithCodefenceRenderers}.
 */
export class CodefenceRenderer {
	constructor(write: CodefenceRendererCallback);
	free(): void;
}

export function mdToHtmlWithCodefenceRenderers(
	md: string,
	options?: ComrakOptions | null,
	renderers?: CodefenceRenderers | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

export type UrlRewriter = (url: string) => string;

export function mdToHtmlWithRewriters(
	md: string,
	options?: ComrakOptions | null,
	imageUrlRewriter?: UrlRewriter | null,
	linkUrlRewriter?: UrlRewriter | null,
): string;

export function mdToText(
	md: string,
	options?: ComrakOptions | null,
	showUrls?: boolean,
	showMarkdown?: boolean,
	tableShadow?: string,
): string;

export interface AnsiTheme {
	heading?: string;
	headingH1?: string;
	headingH2?: string;
	headingH3?: string;
	headingH4?: string;
	headingH5?: string;
	headingH6?: string;
	bold?: string;
	italic?: string;
	strikethrough?: string;
	underline?: string;
	code?: string;
	codeBlock?: string;
	codeBlockBorder?: string;
	link?: string;
	linkUrl?: string;
	blockquote?: string;
	blockquoteBorder?: string;
	thematicBreak?: string;
	listBullet?: string;
	math?: string;
	reset?: string;
	// Behavior flags (not colors):
	showUrls?: boolean;
	showMarkdown?: boolean;
	tableShadow?: string;
	hyperlinks?: boolean;
}

export function mdToAnsi(
	md: string,
	options?: ComrakOptions | null,
	theme?: AnsiTheme,
): string;

export function ansiThemeDark(): AnsiTheme;
export function ansiThemeLight(): AnsiTheme;

export function getFrontmatter(
	md: string,
	options?: ComrakOptions | null,
): string | undefined;

export function healMarkdown(md: string): string;

export type ColorScheme = "light" | "dark";

export function detectColorScheme(colorfgbg?: string): ColorScheme;
export function ansiThemeAuto(colorfgbg?: string): AnsiTheme;

export type InitInput =
	| RequestInfo
	| URL
	| Response
	| BufferSource
	| WebAssembly.Module;
export type SyncInitInput = BufferSource | WebAssembly.Module;

export interface InitOutput {
	readonly memory: WebAssembly.Memory;
}

export function initSync(
	module: { module: SyncInitInput } | SyncInitInput,
): InitOutput;

export default function init(
	module_or_path?:
		| { module_or_path: InitInput | Promise<InitInput> }
		| InitInput
		| Promise<InitInput>,
): Promise<InitOutput>;
