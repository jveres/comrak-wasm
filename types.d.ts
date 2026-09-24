/// <reference lib="dom" />
/// <reference lib="esnext.disposable" />

export interface ExtensionOptions {
	strikethrough?: boolean;
	/** @deprecated Upstream plans removal in Comrak 0.56. Not an HTML sanitizer. */
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
	 * consume the syntax but do not render attributes; mdToAst exposes them.
	 */
	headerAttributes?: boolean;
	/**
	 * Parses attributes in fenced code block info strings. Stock formatters
	 * consume the syntax but do not render attributes; mdToAst exposes them.
	 */
	fencedCodeAttributes?: boolean;
	/**
	 * Parses attributes following inline code spans. Stock formatters consume
	 * the syntax but do not render attributes; mdToAst exposes them.
	 */
	inlineCodeAttributes?: boolean;
	/**
	 * Parses attributes following links and images. Stock formatters consume the
	 * syntax but do not render attributes; mdToAst exposes them.
	 */
	linkAttributes?: boolean;
}

/** A reference-style link label that has no matching definition. */
export interface BrokenLinkReference {
	/** The label after Unicode case folding and whitespace normalization. */
	normalized: string;
	/** The label exactly as written in the source. */
	original: string;
}

/** A resolved link target returned by a {@link BrokenLinkCallback}. */
export interface ResolvedReference {
	url: string;
	/** Link title; omitted or empty for none. */
	title?: string;
}

/**
 * Resolves reference links whose label has no definition. Return a URL string
 * or a {@link ResolvedReference} to link the reference. Return `null` or
 * `undefined` to leave it unresolved, in which case the label renders as
 * literal text. Thrown exceptions and non-conforming return values also leave
 * the reference unresolved.
 */
export type BrokenLinkCallback = (
	reference: BrokenLinkReference,
) => ResolvedReference | string | null | undefined;

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
	/**
	 * Resolves reference links with no matching definition. Applies to every
	 * renderer and to {@link PreparedOptions}, which retains the callback for
	 * the lifetime of the handle.
	 */
	brokenLinkCallback?: BrokenLinkCallback;
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

/**
 * Comrak options prepared once for repeated renders. Dispose the handle when a
 * long-lived application no longer needs it.
 */
export class PreparedOptions {
	constructor(options?: ComrakOptions | null);
	mdToHtml(md: string): string;
	mdToHtmlWithPlugins(
		md: string,
		syntaxHighlighter?: SyntaxHighlighter | null,
		headingAdapter?: HeadingAdapter | null,
	): string;
	mdToHtmlWithCodefenceRenderers(
		md: string,
		renderers: PreparedCodefenceRenderers,
		syntaxHighlighter?: SyntaxHighlighter | null,
		headingAdapter?: HeadingAdapter | null,
	): string;
	mdToCommonmark(md: string): string;
	mdToXml(md: string): string;
	/** `tableShadow` accepts `""` or one non-control Unicode scalar value. */
	mdToText(
		md: string,
		showUrls?: boolean,
		showMarkdown?: boolean,
		tableShadow?: string,
	): string;
	mdToAnsi(md: string, theme?: AnsiTheme | null): string;
	mdToAnsiWithTheme(md: string, theme: PreparedAnsiTheme): string;
	getFrontmatter(md: string): string | undefined;
	free(): void;
	[Symbol.dispose](): void;
}

export function comrakVersion(): string;
/**
 * Escapes text for literal inclusion in a CommonMark document at a
 * position where inline parsing occurs. Use it when serializing
 * user-typed text into Markdown: `**`, `__init__`, or a leading `# `
 * come back escaped so they render as themselves. Comrak escapes more
 * than strictly necessary; the rendering is unaffected.
 */
export function escapeCommonmarkInline(text: string): string;
/**
 * Escapes a URL for inclusion as a CommonMark link destination. Emits
 * the bracketed `<...>` form, which admits spaces and parentheses by
 * construction.
 */
export function escapeCommonmarkLinkDestination(url: string): string;
/**
 * Canonicalizes an inline-intent Markdown paragraph: parse and print
 * back with only the escapes that matter, while line-edge whitespace
 * survives as numeric character references. The output never ends
 * with the printer's own trailing newline.
 */
export function canonicalizeCommonmarkInline(
	md: string,
	options?: ComrakOptions | null,
): string;
/**
 * Renders ONE paragraph's inline Markdown to HTML — the explicit
 * inline-only contract: the input must parse to exactly one paragraph
 * (or nothing, which renders ""); anything else throws. The output is
 * the paragraph's inner HTML with HTML5 break spelling (`<br>`, no
 * cosmetic newline), ready to splice into a host element.
 */
export function mdToInlineHtml(
	md: string,
	options?: ComrakOptions | null,
): string;

/** A position in the Markdown source (1-based). */
export interface AstPoint {
	line: number;
	column: number;
}

/** Parsed attribute data, not sanitized HTML attributes. */
export interface AstAttributes {
	/** Last explicitly parsed #id, omitted when absent. */
	id?: string;
	/** Classes in source order, including duplicates. */
	classes: string[];
	/** Key/value pairs in source order, including duplicate keys. Untrusted data. */
	pairs: [string, string][];
}

/**
 * One AST node as plain JSON. `type` is comrak's node kind in camelCase.
 * Optional fields carry the node's payload; absent attributes stay omitted.
 */
export interface AstNode {
	type: string;
	sourcepos: { start: AstPoint; end: AstPoint };
	/** Present only when an enabled attribute extension parses attributes. */
	attributes?: AstAttributes;
	literal?: string;
	level?: number;
	setext?: boolean;
	listType?: string;
	start?: number;
	delimiter?: string;
	tight?: boolean;
	fenced?: boolean;
	info?: string;
	url?: string;
	title?: string;
	name?: string;
	header?: boolean;
	alignments?: string[];
	checked?: boolean;
	symbol?: string;
	displayMath?: boolean;
	dollarMath?: boolean;
	code?: string;
	emoji?: string;
	alertType?: string;
	children?: AstNode[];
}

/**
 * Parses the document and returns the whole AST as plain JSON — the
 * general projection for tooling and custom renderers. Comrak's tree
 * is arena-allocated and cannot cross the wasm boundary as live
 * objects; this is one serialization into JS-native values, every
 * node type mapped exhaustively.
 */
export function mdToAst(md: string, options?: ComrakOptions | null): AstNode;
export function mdToHtml(md: string, options?: ComrakOptions | null): string;

/**
 * Render source.slice(0, writingOffset) with append-only delimiter healing and
 * a U+2060 cursor marker at the rendered writing end, using one Markdown parse.
 * writingOffset counts UTF-16 code units and must not split a surrogate pair.
 * The marker is reserved; pass Markdown without cursor markers. Replace the
 * returned marker with your cursor element after HTML post-processing.
 */
export function mdToStreamingHtml(
	source: string,
	writingOffset: number,
	options?: ComrakOptions | null,
): string;

export function mdToCommonmark(
	md: string,
	options?: ComrakOptions | null,
): string;

export type SyntaxHighlightCallback = (code: string, lang: string) => string;

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
	[Symbol.dispose](): void;
}

export class HeadingAdapter {
	constructor(enter: HeadingAdapterCallback, exit: HeadingAdapterCallback);
	/** Creates a new adapter backed by the same callbacks. */
	clone(): HeadingAdapter;
	free(): void;
	[Symbol.dispose](): void;
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

/**
 * Per-language code-fence renderers: a plain object keyed by fence language.
 * Each value is a callback or a {@link CodefenceRenderer} handle. Handles are
 * cloned on the way in, so the caller still owns (and frees) the original.
 */
export type CodefenceRenderers = Record<
	string,
	CodefenceRendererCallback | CodefenceRenderer
>;

/**
 * Code-fence renderer registrations validated once for repeated renders.
 * Only {@link PreparedOptions.mdToHtmlWithCodefenceRenderers} accepts this
 * handle; the top-level functions take a plain {@link CodefenceRenderers}
 * object and throw a `TypeError` when given a prepared handle.
 */
export class PreparedCodefenceRenderers {
	constructor(renderers?: CodefenceRenderers | null);
	free(): void;
	[Symbol.dispose](): void;
}

/**
 * Wraps one {@link CodefenceRendererCallback} in a WASM handle. It is
 * accepted as a value in a {@link CodefenceRenderers} object, next to plain
 * callbacks. Most callers pass the callback directly instead.
 */
export class CodefenceRenderer {
	constructor(write: CodefenceRendererCallback);
	clone(): CodefenceRenderer;
	free(): void;
	[Symbol.dispose](): void;
}

export function mdToHtmlWithCodefenceRenderers(
	md: string,
	options?: ComrakOptions | null,
	renderers?: CodefenceRenderers | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

/**
 * Rewrites one link or image URL before it is written to HTML.
 *
 * **Fails open.** If the callback throws, or returns anything other than a
 * string, the error is swallowed and the ORIGINAL, unrewritten URL is
 * emitted. A rewriter used as a security guard (for example, to block
 * `javascript:` URLs or untrusted hosts) must therefore never throw to
 * reject a URL: catch errors inside the callback and return a safe
 * replacement string such as `""` or `"#"`.
 *
 * With `render.unsafe` off, comrak drops dangerous source URLs
 * (`javascript:`, `vbscript:`, `file:`, most `data:`) before the rewriter
 * runs. The rewriter's return value is only href-escaped, not re-checked.
 */
export type UrlRewriter = (url: string) => string;

export function mdToHtmlWithRewriters(
	md: string,
	options?: ComrakOptions | null,
	imageUrlRewriter?: UrlRewriter | null,
	linkUrlRewriter?: UrlRewriter | null,
): string;

/**
 * The COMBINED entry: URL rewriters together with the render plugins —
 * highlighter, heading adapter, per-language codefence renderers. The
 * rewriters fail open; see {@link UrlRewriter} before using them as a
 * security guard.
 */
export function mdToHtmlWithRewritersAndPlugins(
	md: string,
	options?: ComrakOptions | null,
	imageUrlRewriter?: UrlRewriter | null,
	linkUrlRewriter?: UrlRewriter | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
	renderers?: CodefenceRenderers | null,
): string;

export function mdToText(
	md: string,
	options?: ComrakOptions | null,
	showUrls?: boolean,
	showMarkdown?: boolean,
	/** Accepts `""` or one non-control Unicode scalar value. */
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
	/** Accepts `""` or one non-control Unicode scalar value. */
	tableShadow?: string;
	hyperlinks?: boolean;
}

export function mdToAnsi(
	md: string,
	options?: ComrakOptions | null,
	theme?: AnsiTheme | null,
): string;

/** ANSI theme validated and merged once for repeated renders. */
export class PreparedAnsiTheme {
	constructor(theme?: AnsiTheme | null);
	free(): void;
	[Symbol.dispose](): void;
}

export function mdToAnsiWithTheme(
	md: string,
	options: ComrakOptions | null | undefined,
	theme: PreparedAnsiTheme,
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

/** A complete render snapshot. Compare every block: appending a reference
 * definition or footnote can invalidate output anywhere in the document. */
export interface HtmlBlockSnapshot {
	html: string;
	/** Exclusive UTF-16 ends of independently parseable HTML fragments.
	 * Null when an HTML block requires parsing the whole document together.
	 * Boundaries describe output, not stable Markdown-source identities. */
	blockEnds: number[] | null;
	/** Ascending indices of fragments holding inline raw HTML, such as `<br>`
	 * or `<kbd>`. Sanitize and parse each on its own: an unclosed inline tag
	 * then stays in its fragment instead of carrying into later blocks.
	 * Null exactly when `blockEnds` is null. */
	rawHtmlBlocks: number[] | null;
}

/** ANSI input to escaped HTML, not Markdown-to-terminal output.
 * Enable textual to decode \\e[, \\033[, \\x1b[, \\u001b[, and ^[[ spellings.
 * sourceMap is the code element's data-md-source attribute from a mapped render.
 * Output sourceMap describes visible text only; invalid input maps yield "".
 * Hosts supply CSS for ansi-* classes and own all animation. */
export function ansiToHtml(
	code: string,
	textual?: boolean,
	sourceMap?: string,
): { html: string; sourceMap?: string };
export function mdToHtmlBlocks(
	markdown: string,
	options?: ComrakOptions | null,
	sourceMap?: boolean,
): HtmlBlockSnapshot;
export function mdToStreamingHtmlBlocks(
	markdown: string,
	writingOffset: number,
	options?: ComrakOptions | null,
	sourceMap?: boolean,
): HtmlBlockSnapshot;
