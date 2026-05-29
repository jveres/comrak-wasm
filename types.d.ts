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
	phoenixHeex?: boolean;
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

export class SyntaxHighlighter {
	constructor(
		highlight: (code: string, lang: string | undefined) => string,
		pre: (attrs: Record<string, string>) => string,
		code: (attrs: Record<string, string>) => string,
	);
	free(): void;
}

export class HeadingAdapter {
	constructor(
		enter: (heading: { level: number; content: string }) => string,
		exit: (heading: { level: number; content: string }) => string,
	);
	free(): void;
}

export function mdToHtmlWithPlugins(
	md: string,
	options?: ComrakOptions | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

export function mdToXml(md: string, options?: ComrakOptions | null): string;

export function mdToXmlWithPlugins(
	md: string,
	options?: ComrakOptions | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

/**
 * Low-level renderer wrapper exported by the WASM module. Most callers don't
 * construct this directly — pass a plain
 * `{ [lang]: (lang, meta, code) => string }` object as the `renderers` argument
 * of {@link mdToHtmlWithCodefenceRenderers}.
 */
export class CodefenceRenderer {
	constructor(write: (lang: string, meta: string, code: string) => string);
	free(): void;
}

export function mdToHtmlWithCodefenceRenderers(
	md: string,
	options?: ComrakOptions | null,
	renderers?: Record<
		string,
		(lang: string, meta: string, code: string) => string
	> | null,
	syntaxHighlighter?: SyntaxHighlighter | null,
	headingAdapter?: HeadingAdapter | null,
): string;

export function mdToHtmlWithRewriters(
	md: string,
	options?: ComrakOptions | null,
	imageUrlRewriter?: ((url: string) => string) | null,
	linkUrlRewriter?: ((url: string) => string) | null,
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

export function detectColorScheme(colorfgbg?: string): string;
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
