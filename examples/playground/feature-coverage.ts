import type {
	ExtensionOptions,
	ParseOptions,
	RenderOptions,
} from "../../types";

/**
 * Compile-time inventory for the playground fixture. Adding a public option
 * requires an explicit coverage decision here.
 */
export const extensionFeatureCoverage = {
	strikethrough: "sample",
	tagfilter: "sample",
	table: "sample",
	autolink: "sample",
	tasklist: "sample",
	superscript: "sample",
	headerIds: "deprecated alias; headerIdPrefix is sampled",
	headerIdPrefix: "sample",
	headerIdPrefixInHref: "sample",
	footnotes: "sample",
	inlineFootnotes: "sample",
	descriptionLists: "sample",
	frontMatterDelimiter: "sample",
	multilineBlockQuotes: "sample",
	alerts: "sample",
	mathDollars: "sample",
	mathLatex: "sample",
	mathCode: "sample",
	shortcodes: "sample",
	wikilinksTitleAfterPipe: "URL-first toolbar mode",
	wikilinksTitleBeforePipe: "title-first toolbar mode",
	underline: "sample",
	subscript: "sample",
	spoiler: "sample",
	greentext: "sample",
	cjkFriendlyEmphasis: "sample",
	subtext: "sample",
	highlight: "sample",
	insert: "sample",
	phoenixHeex: "sample",
	blockDirective: "sample",
	headerAttributes: "sample; metadata is parser-only",
	fencedCodeAttributes: "sample; metadata is parser-only",
	inlineCodeAttributes: "sample; metadata is parser-only",
	linkAttributes: "sample; metadata is parser-only",
} as const satisfies Record<keyof ExtensionOptions, string>;

export const parseFeatureCoverage = {
	smart: "sample",
	defaultInfoString: "unlabeled code fence",
	relaxedTasklistMatching: "relaxed task marker",
	tasklistInTable: "task table column",
	relaxedAutolinks: "bracketed URL",
	ignoreSetext: "intentionally false so the setext sample renders",
	leaveFootnoteDefinitions:
		"intentionally false because stock formatters require reordered definitions",
	escapedCharSpans: "escaped character sample",
	sourceposChars: "CJK source-position sample",
	brokenLinkCallback:
		"intentionally unset; a function cannot ride the serializable playground fixture",
} as const satisfies Record<keyof ParseOptions, string>;

export const renderFeatureCoverage = {
	hardbreaks: "soft-break sample",
	githubPreLang: "labelled code fence",
	fullInfoString: "code-fence metadata",
	width: "CommonMark output",
	unsafe: "trusted raw HTML toolbar mode",
	escape: "escaped raw HTML toolbar mode",
	listStyle: "CommonMark output",
	sourcepos: "HTML and XML output",
	escapedCharSpans: "escaped character sample",
	ignoreEmptyLinks: "empty-link sample",
	gfmQuirks: "nested strong sample",
	preferFenced: "CommonMark output",
	figureWithCaption: "titled image sample",
	tasklistClasses: "task-list sample",
	alertStyle: "semantic alert sample",
	olWidth: "CommonMark output",
	experimentalMinimizeCommonmark:
		"intentionally off because it is brute-force and unsuitable per keystroke",
	compactHtml: "intentionally off so HTML source stays readable",
} as const satisfies Record<keyof RenderOptions, string>;
