import {
	__mdToHtmlWithCodefenceRenderersOwned,
	__mdToHtmlWithPluginsOwned,
	mdToXml as renderXml,
} from "./pkg/comrak.js";

export {
	ansiThemeAuto,
	ansiThemeDark,
	ansiThemeLight,
	CodefenceRenderer,
	comrakVersion,
	default,
	detectColorScheme,
	getFrontmatter,
	HeadingAdapter,
	healMarkdown,
	initSync,
	mdToAnsi,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithRewriters,
	mdToText,
	mdToXml,
	SyntaxHighlighter,
} from "./pkg/comrak.js";

function cloneAdapter(adapter) {
	return adapter == null ? undefined : adapter.clone();
}

export function mdToHtmlWithPlugins(
	markdown,
	options,
	syntaxHighlighter,
	headingAdapter,
) {
	return __mdToHtmlWithPluginsOwned(
		markdown,
		options,
		cloneAdapter(syntaxHighlighter),
		cloneAdapter(headingAdapter),
	);
}

export function mdToXmlWithPlugins(
	markdown,
	options,
	_syntaxHighlighter,
	_headingAdapter,
) {
	return renderXml(markdown, options);
}

export function mdToHtmlWithCodefenceRenderers(
	markdown,
	options,
	renderers,
	syntaxHighlighter,
	headingAdapter,
) {
	return __mdToHtmlWithCodefenceRenderersOwned(
		markdown,
		options,
		renderers,
		cloneAdapter(syntaxHighlighter),
		cloneAdapter(headingAdapter),
	);
}
