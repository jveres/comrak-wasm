/**
 * Canonical extension preset shared by the CLI, playground, and tests.
 * @type {import("../../types").ExtensionOptions}
 */
export const comrakExtensions = {
	strikethrough: true,
	tagfilter: true,
	table: true,
	tasklist: true,
	autolink: true,
	headerIdPrefix: "feature-",
	headerIdPrefixInHref: true,
	frontMatterDelimiter: "---",
	alerts: true,
	footnotes: true,
	inlineFootnotes: true,
	mathDollars: true,
	mathLatex: true,
	mathCode: true,
	superscript: true,
	subscript: true,
	underline: true,
	spoiler: true,
	greentext: true,
	cjkFriendlyEmphasis: true,
	subtext: true,
	highlight: true,
	insert: true,
	descriptionLists: true,
	multilineBlockQuotes: true,
	wikilinksTitleAfterPipe: true,
	shortcodes: true,
	phoenixHeex: true,
	blockDirective: true,
	headerAttributes: true,
	fencedCodeAttributes: true,
	inlineCodeAttributes: true,
	linkAttributes: true,
};

/** @type {import("../../types").ParseOptions} */
export const comrakParseOptions = {
	smart: true,
	defaultInfoString: "text",
	relaxedTasklistMatching: true,
	tasklistInTable: true,
	relaxedAutolinks: true,
	escapedCharSpans: true,
	sourceposChars: true,
};

/** @type {import("../../types").RenderOptions} */
export const comrakRenderOptions = {
	hardbreaks: true,
	githubPreLang: true,
	fullInfoString: true,
	width: 72,
	listStyle: "plus",
	sourcepos: true,
	escapedCharSpans: true,
	ignoreEmptyLinks: true,
	gfmQuirks: true,
	preferFenced: true,
	figureWithCaption: true,
	tasklistClasses: true,
	alertStyle: "semantic",
	olWidth: 4,
};

/**
 * Build the option profile used by the browser playground.
 *
 * @param {boolean} extensionsEnabled
 * @param {string} rawHtmlMode
 * @param {string} wikilinkMode
 * @returns {import("../../types").ComrakOptions}
 */
export function createPlaygroundOptions(
	extensionsEnabled,
	rawHtmlMode,
	wikilinkMode,
) {
	const render = {
		escape: rawHtmlMode === "escape",
		unsafe: rawHtmlMode === "trusted",
	};
	if (!extensionsEnabled) return { render };

	const extension = { ...comrakExtensions };
	if (wikilinkMode === "title-first") {
		extension.wikilinksTitleAfterPipe = false;
		extension.wikilinksTitleBeforePipe = true;
	}

	return {
		extension,
		parse: { ...comrakParseOptions },
		render: { ...comrakRenderOptions, ...render },
	};
}
